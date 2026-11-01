export const CONNECTION_STATES = ['online', 'offline', 'degraded'] as const;

/** `degraded` is reserved for transports that detect a poor connection, which arrive with later specs. */
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export function readBrowserConnection(): ConnectionState {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online';
}

/** Returns a function that stops watching. Does nothing outside a browser. */
export function watchBrowserConnection(onChange: (state: ConnectionState) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => onChange('online');
  const onOffline = () => onChange('offline');
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
