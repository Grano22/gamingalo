import { GamingaloError } from '@gamingalo/errors';
import { toStorageError } from './storage-errors';

export type CacheData = Blob | ArrayBuffer | string;

/** Files the browser may discard, so a game must be able to recreate them. */
export interface GameCache {
  /** `true` when files use browser storage, and `false` when they last only for this session. */
  readonly persistent: boolean;
  get(key: string): Promise<Blob | undefined>;
  put(key: string, data: CacheData): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

function assertKey(key: unknown): void {
  if (typeof key !== 'string' || key === '') {
    throw new GamingaloError('INVALID_ARGUMENT', 'A cache key must be a non-empty string.');
  }
}

export function createMemoryCache(): GameCache {
  const files = new Map<string, Blob>();
  return {
    persistent: false,
    get: async (key) => {
      assertKey(key);
      return files.get(key);
    },
    put: async (key, data) => {
      assertKey(key);
      files.set(key, data instanceof Blob ? data : new Blob([data]));
    },
    delete: async (key) => {
      assertKey(key);
      return files.delete(key);
    },
    clear: async () => files.clear(),
  };
}

export function createBrowserCache(gameId: string, storage: CacheStorage): GameCache {
  const cacheName = `gamingalo:${gameId}`;
  // The Cache API needs a URL. Nothing ever requests it, and `.invalid` can never resolve.
  const urlFor = (key: string) => `https://cache.gamingalo.invalid/${encodeURIComponent(key)}`;

  const attempt = async <T>(action: (cache: Cache) => Promise<T>): Promise<T> => {
    try {
      return await action(await storage.open(cacheName));
    } catch (error) {
      throw toStorageError(error);
    }
  };

  return {
    persistent: true,
    get: async (key) => {
      assertKey(key);
      return attempt(async (cache) => {
        const response = await cache.match(urlFor(key));
        return response ? response.blob() : undefined;
      });
    },
    put: async (key, data) => {
      assertKey(key);
      return attempt((cache) => cache.put(urlFor(key), new Response(data)));
    },
    delete: async (key) => {
      assertKey(key);
      return attempt((cache) => cache.delete(urlFor(key)));
    },
    clear: async () => {
      try {
        await storage.delete(cacheName);
      } catch (error) {
        throw toStorageError(error);
      }
    },
  };
}

/** Falls back to memory where the Cache API is missing, such as on insecure origins. */
export function createGameCache(gameId: string): GameCache {
  return typeof caches === 'undefined' ? createMemoryCache() : createBrowserCache(gameId, caches);
}
