export function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Watches the Page Visibility and Page Lifecycle APIs. Callbacks may fire more
 * than once for one transition, so the caller removes duplicates.
 * Returns a function that stops watching. Does nothing outside a browser.
 */
export function watchPageLifecycle(onSuspend: () => void, onResume: () => void): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};

  const onVisibilityChange = () => (isPageHidden() ? onSuspend() : onResume());
  const onShown = () => {
    if (!isPageHidden()) onResume();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('freeze', onSuspend);
  document.addEventListener('resume', onShown);
  window.addEventListener('pagehide', onSuspend);
  window.addEventListener('pageshow', onShown);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('freeze', onSuspend);
    document.removeEventListener('resume', onShown);
    window.removeEventListener('pagehide', onSuspend);
    window.removeEventListener('pageshow', onShown);
  };
}
