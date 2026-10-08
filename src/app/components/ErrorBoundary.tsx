import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  DOM_MUTATION_RELOAD_MARKER,
  STALE_CHUNK_RELOAD_MARKER,
  isReactDomRemovalError,
  isStaleChunkError,
  reloadOnce,
} from '@/app/errors/recoverableErrors';
import { getFriendlyErrorMessage, reportClientError } from '@/app/services/errorTelemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  incidentId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    incidentId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, incidentId: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isChunkError = isStaleChunkError(error);
    const isDomRemovalError = isReactDomRemovalError(error);
    const report = reportClientError(error, {
      area: 'AppErrorBoundary',
      severity: isChunkError || isDomRemovalError ? 'warning' : 'fatal',
      errorInfo,
      tags: {
        recoverableReload: isChunkError || isDomRemovalError,
      },
    });

    this.setState({ incidentId: report.id });

    if (isChunkError) {
      reloadOnce(STALE_CHUNK_RELOAD_MARKER);
      return;
    }

    if (isDomRemovalError) {
      reloadOnce(DOM_MUTATION_RELOAD_MARKER);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Terjadi Kesalahan Aplikasi
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
              {getFriendlyErrorMessage(this.state.error)}
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-left overflow-auto max-h-32">
                {this.state.incidentId ? (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ref: {this.state.incidentId}
                  </p>
                ) : null}
                <code className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                  {import.meta.env.DEV ? this.state.error.toString() : 'Detail error tersimpan di sesi browser.'}
                </code>
              </div>
            )}

            <Button 
              onClick={this.handleReload} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Muat Ulang Aplikasi
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
