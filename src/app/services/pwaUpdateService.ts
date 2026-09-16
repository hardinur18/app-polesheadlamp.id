import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function shouldCheckForUpdate() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  return document.visibilityState === 'visible' && navigator.onLine;
}

export function registerPwaUpdateService() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

  const checkForUpdate = (registration?: ServiceWorkerRegistration) => {
    if (!registration || !shouldCheckForUpdate()) return;
    void registration.update().catch(() => undefined);
  };

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateServiceWorker?.(true);
    },
    onRegisteredSW(_swUrl, registration) {
      checkForUpdate(registration);

      window.setInterval(() => {
        checkForUpdate(registration);
      }, UPDATE_CHECK_INTERVAL_MS);

      window.addEventListener('online', () => {
        checkForUpdate(registration);
      });

      document.addEventListener('visibilitychange', () => {
        checkForUpdate(registration);
      });
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('rhi:pwa-offline-ready'));
    },
  });
}
