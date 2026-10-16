export function registerPwa() {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  window.addEventListener(
    'load',
    () => {
      // Installation may be disabled by browser policy; the ordinary app still works.
      void navigator.serviceWorker
        .register('/service-worker.js', { updateViaCache: 'none' })
        .catch(() => undefined);
    },
    { once: true },
  );
}
