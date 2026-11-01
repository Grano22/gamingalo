/** Memory that lasts until the SDK shuts down or the page closes. Values are kept by reference. */
export interface SessionMemory {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
}

export function createSessionMemory(): SessionMemory {
  const values = new Map<string, unknown>();
  return {
    get: <T>(key: string) => values.get(key) as T | undefined,
    set: (key, value) => void values.set(key, value),
    has: (key) => values.has(key),
    delete: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
