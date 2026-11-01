export interface StorageEstimate {
  usedBytes: number;
  quotaBytes: number;
}

export interface StorageInfo {
  /** Returns `unknown` where the browser doesn't report usage. */
  estimate(): Promise<StorageEstimate | 'unknown'>;
  isPersistent(): Promise<boolean>;
  /**
   * Asks the browser not to evict this game's data. Some browsers decide silently, while Firefox
   * asks the player and stays pending until they answer, so don't wait on this during startup.
   */
  requestPersistence(): Promise<boolean>;
}

export function createBrowserStorageInfo(): StorageInfo {
  const manager = () => (typeof navigator === 'undefined' ? undefined : navigator.storage);

  const safely = async <T>(action: () => Promise<T> | undefined, fallback: T): Promise<T> => {
    try {
      return (await action()) ?? fallback;
    } catch {
      return fallback;
    }
  };

  return {
    estimate: () =>
      safely<StorageEstimate | 'unknown'>(async () => {
        const estimate = await manager()?.estimate?.();
        if (estimate?.usage === undefined || estimate.quota === undefined) return 'unknown';
        return { usedBytes: estimate.usage, quotaBytes: estimate.quota };
      }, 'unknown'),
    isPersistent: () => safely(() => manager()?.persisted?.(), false),
    requestPersistence: () => safely(() => manager()?.persist?.(), false),
  };
}

export function createMockStorageInfo(): StorageInfo {
  let persistent = false;
  return {
    estimate: async () => ({ usedBytes: 0, quotaBytes: 1024 * 1024 * 1024 }),
    isPersistent: async () => persistent,
    requestPersistence: async () => {
      persistent = true;
      return true;
    },
  };
}
