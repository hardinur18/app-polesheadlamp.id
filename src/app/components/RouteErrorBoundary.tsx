import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import {
  DOM_MUTATION_RELOAD_MARKER,
  STALE_CHUNK_RELOAD_MARKER,
  isReactDomRemovalError,
  isStaleChunkError,
  reloadOnce,
} from '@/app/errors/recoverableErrors';

const getRouteErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'statusText' in error) {
    return String((error as { statusText?: unknown }).statusText ?? 'Route error');
  }
  return String(error || 'Route error');
};

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = getRouteErrorMessage(error);
  const isDomRemovalError = isReactDomRemovalError(error);
  const isChunkError = isStaleChunkError(error);
  const isRecoverableReloadError = isDomRemovalError || isChunkError;
  const isMasterDataProviderError = /useMasterData must be used within a MasterDataProvider/i.test(message);

  useEffect(() => {
    if (isChunkError) {
      reloadOnce(STALE_CHUNK_RELOAD_MARKER);
      return;
    }

    if (isDomRemovalError) {
      reloadOnce(DOM_MUTATION_RELOAD_MARKER);
    }
  }, [isChunkError, isDomRemovalError]);

  const title = isMasterDataProviderError
    ? 'Konteks aplikasi belum siap'
    : isRecoverableReloadError
      ? 'Aplikasi perlu dimuat ulang'
      : 'Halaman tidak bisa dibuka';

  const description = isMasterDataProviderError
    ? 'Halaman ini membutuhkan master data, tetapi provider aplikasi belum aktif di route yang sedang dibuka. Kembali ke Dashboard akan membentuk ulang wrapper aplikasi.'
    : isRecoverableReloadError
      ? 'Tampilan mendeteksi perubahan DOM atau asset lama. Muat ulang halaman untuk mengambil state terbaru.'
      : 'Aplikasi menangkap error saat membuka halaman ini. Muat ulang halaman atau kembali ke Dashboard untuk memulai ulang state.';

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="mx-auto mt-20 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
        <code className="mt-4 block max-h-24 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {message}
        </code>
        <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Muat Ulang
        </Button>
        {!isRecoverableReloadError ? (
          <Button className="mt-3 w-full" variant="outline" onClick={() => window.location.assign('/dashboard/')}>
            <Home className="mr-2 h-4 w-4" />
            Ke Dashboard
          </Button>
        ) : null}
      </section>
    </main>
  );
}
