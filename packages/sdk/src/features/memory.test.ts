import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { createBrowserCache, createGameCache, createMemoryCache } from './cache';
import { createSessionMemory } from './session';
import { toStorageError } from './storage-errors';

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
});

describe('session memory', () => {
  it('stores, reads and deletes values by reference', () => {
    const session = createSessionMemory();
    const value = { level: 1 };
    session.set('state', value);

    expect(session.get('state')).toBe(value);
    expect(session.has('state')).toBe(true);
    expect(session.delete('state')).toBe(true);
    expect(session.get('state')).toBeUndefined();
  });

  it('clears everything', () => {
    const session = createSessionMemory();
    session.set('a', 1);
    session.clear();
    expect(session.has('a')).toBe(false);
  });

  it('is empty after the SDK restarts', async () => {
    const sdk = await startSdk();
    sdk.session.set('a', 1);
    await sdk.shutdown();

    const restarted = await startSdk();
    expect(restarted.session.has('a')).toBe(false);
  });
});

describe('memory cache', () => {
  it('stores each data type as a blob', async () => {
    const cache = createMemoryCache();
    await cache.put('text', 'hello');
    await cache.put('bytes', new TextEncoder().encode('hi').buffer);
    await cache.put('blob', new Blob(['x']));

    expect(await (await cache.get('text'))?.text()).toBe('hello');
    expect(await (await cache.get('bytes'))?.text()).toBe('hi');
    expect(await (await cache.get('blob'))?.text()).toBe('x');
    expect(cache.persistent).toBe(false);
  });

  it('deletes and clears', async () => {
    const cache = createMemoryCache();
    await cache.put('a', 'x');
    expect(await cache.delete('a')).toBe(true);
    expect(await cache.delete('a')).toBe(false);

    await cache.put('b', 'x');
    await cache.clear();
    expect(await cache.get('b')).toBeUndefined();
  });

  it('rejects an empty key', async () => {
    await expect(createMemoryCache().put('', 'x')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

describe('browser cache', () => {
  it('maps a full cache to STORAGE_QUOTA_EXCEEDED', async () => {
    const storage = {
      open: async () => ({
        put: async () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    } as unknown as CacheStorage;

    await expect(createBrowserCache('x', storage).put('a', 'b')).rejects.toMatchObject({
      code: 'STORAGE_QUOTA_EXCEEDED',
    });
  });

  it('maps other failures to STORAGE_UNAVAILABLE', async () => {
    const storage = {
      open: async () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as CacheStorage;

    await expect(createBrowserCache('x', storage).get('a')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('falls back to memory without the Cache API', () => {
    vi.stubGlobal('caches', undefined);
    expect(createGameCache('x').persistent).toBe(false);
  });

  it('uses memory in mock mode', async () => {
    const sdk = await createMockSdk();
    expect(sdk.cache.persistent).toBe(false);
  });
});

describe('toStorageError', () => {
  it('maps a clone failure to INVALID_ARGUMENT', () => {
    expect(toStorageError(new DOMException('x', 'DataCloneError')).code).toBe('INVALID_ARGUMENT');
  });

  it('keeps the original as the cause', () => {
    const cause = new Error('boom');
    const error = toStorageError(cause);
    expect(error.code).toBe('STORAGE_UNAVAILABLE');
    expect(error.cause).toBe(cause);
  });

  it('survives values that are not errors', () => {
    expect(toStorageError(null).code).toBe('STORAGE_UNAVAILABLE');
  });
});
