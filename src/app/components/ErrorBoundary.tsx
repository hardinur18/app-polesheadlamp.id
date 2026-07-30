import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
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
              Mohon maaf, aplikasi mengalami kendala saat memproses data. Hal ini mungkin disebabkan oleh koneksi internet atau kompatibilitas perangkat.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-left overflow-auto max-h-32">
                <code className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                  {this.state.error.toString()}
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
