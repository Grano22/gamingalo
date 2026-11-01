import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGamingaloError, type ErrorCode } from '../index';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import {
  createMemorySaveBackend,
  createSaves,
  decodeBlobs,
  encodeBlobs,
  type SaveBackend,
  type Saves,
} from './saves';
import { createMemoryStore, type KeyValueStore } from './settings';
import { createBrowserStorageInfo } from './storage';

function create(backend: SaveBackend = createMemorySaveBackend(), markers: KeyValueStore = createMemoryStore()): Saves {
  return createSaves({ gameId: 'my-game', backend, markers, now: () => 1000 });
}

async function expectCode(action: () => unknown, code: ErrorCode): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(isGamingaloError(error) && error.code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
});

describe('saves', () => {
  it('writes, reads, lists and deletes', async () => {
    const saves = create();

    expect(await saves.write('slot-1', { level: 3 })).toEqual({ slot: 'slot-1', version: 1, updatedAt: 1000 });
    expect(await saves.read('slot-1')).toEqual({ slot: 'slot-1', version: 1, updatedAt: 1000, data: { level: 3 } });
    expect(await saves.list()).toEqual([{ slot: 'slot-1', version: 1, updatedAt: 1000 }]);

    await saves.delete('slot-1');
    expect(await saves.read('slot-1')).toBeUndefined();
  });

  it('rejects invalid slots', async () => {
    const saves = create();
    await expectCode(() => saves.write('', 1), 'INVALID_ARGUMENT');
    await expectCode(() => saves.read(''), 'INVALID_ARGUMENT');
    await expectCode(() => saves.delete(''), 'INVALID_ARGUMENT');
  });

  it('rejects an invalid schema version', () => {
    const saves = create();
    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(() => saves.configure({ version })).toThrowError(/positive whole number/);
    }
  });
});

describe('blob encoding', () => {
  it('restores nested Blobs and Files with their bytes and metadata', async () => {
    const original = {
      level: 1,
      logo: new Blob(['pixels'], { type: 'image/png' }),
      items: [new File(['song'], 'song.mp3', { type: 'audio/mpeg', lastModified: 7 })],
    };

    const encoded = (await encodeBlobs(original)) as Record<string, unknown>;
    expect(encoded['logo']).not.toBeInstanceOf(Blob);

    const decoded = decodeBlobs(encoded) as typeof original;
    expect(decoded.level).toBe(1);
    expect(decoded.logo).toBeInstanceOf(Blob);
    expect(decoded.logo.type).toBe('image/png');
    expect(await decoded.logo.text()).toBe('pixels');
    const file = decoded.items[0] as File;
    expect(file).toBeInstanceOf(File);
    expect([file.name, file.lastModified, await file.text()]).toEqual(['song.mp3', 7, 'song']);
  });

  it('does not change the original data', async () => {
    const logo = new Blob(['x']);
    const original = { logo };
    await encodeBlobs(original);
    expect(original.logo).toBe(logo);
  });

  it('keeps other values, and handles circular and shared references', async () => {
    const shared = new Blob(['x']);
    const original: Record<string, unknown> = { a: shared, b: shared, date: new Date(5), nothing: null };
    original['self'] = original;

    const decoded = decodeBlobs(await encodeBlobs(original)) as typeof original;

    expect(decoded['self']).toBe(decoded);
    expect(decoded['a']).toBe(decoded['b']);
    expect(decoded['date']).toEqual(new Date(5));
    expect(decoded['nothing']).toBeNull();
  });

  it('handles a key that could pollute prototypes', async () => {
    const original = JSON.parse('{"__proto__": {"polluted": true}}') as object;
    const decoded = decodeBlobs(await encodeBlobs(original)) as object;
    expect(Object.keys(decoded)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect((decoded as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('migrations', () => {
  it('upgrades through each version and stores the result', async () => {
    const backend = createMemorySaveBackend();
    await backend.put({ slot: 'a', version: 1, updatedAt: 5, data: { level: 1 } });
    const first = vi.fn((old: { level: number }) => ({ ...old, money: 0 }));
    const second = vi.fn((old: { level: number; money: number }) => ({ ...old, rank: 'new' }));
    const saves = create(backend);
    saves.configure({ version: 3, migrations: { 1: first, 2: second } });

    const record = await saves.read('a');

    expect(record).toEqual({ slot: 'a', version: 3, updatedAt: 5, data: { level: 1, money: 0, rank: 'new' } });
    expect(await backend.get('a')).toEqual(record);

    await saves.read('a');
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('leaves the save unchanged when a migration throws', async () => {
    const backend = createMemorySaveBackend();
    const original = { slot: 'a', version: 1, updatedAt: 5, data: { level: 1 } };
    await backend.put(original);
    const saves = create(backend);
    saves.configure({
      version: 3,
      migrations: {
        1: (old) => old,
        2: () => {
          throw new Error('bad data');
        },
      },
    });

    await expectCode(() => saves.read('a'), 'SAVE_MIGRATION_FAILED');
    expect(await backend.get('a')).toEqual(original);
  });

  it('fails when a migration step is missing', async () => {
    const backend = createMemorySaveBackend();
    await backend.put({ slot: 'a', version: 1, updatedAt: 5, data: {} });
    const saves = create(backend);
    saves.configure({ version: 2 });
    await expectCode(() => saves.read('a'), 'SAVE_MIGRATION_FAILED');
  });

  it('refuses a save from a newer version and leaves it unchanged', async () => {
    const backend = createMemorySaveBackend();
    const newer = { slot: 'a', version: 9, updatedAt: 5, data: {} };
    await backend.put(newer);

    await expectCode(() => create(backend).read('a'), 'SAVE_VERSION_TOO_NEW');
    expect(await backend.get('a')).toEqual(newer);
  });
});

describe('storage failures', () => {
  it.each([
    ['QuotaExceededError', 'STORAGE_QUOTA_EXCEEDED'],
    ['DataCloneError', 'INVALID_ARGUMENT'],
    ['UnknownError', 'STORAGE_UNAVAILABLE'],
  ] as const)('maps %s to %s', async (name, code) => {
    const backend = createMemorySaveBackend();
    backend.put = async () => {
      throw new DOMException('x', name);
    };
    await expectCode(() => create(backend).write('a', 1), code);
  });

  it('keeps the save working when the eviction marker cannot be written', async () => {
    const saves = create(createMemorySaveBackend(), {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    await saves.write('a', 1);
    expect(await saves.wasEvicted()).toBe(false);
  });
});

describe('wasEvicted', () => {
  it('reports true once when saves disappear', async () => {
    const backend = createMemorySaveBackend();
    const saves = create(backend);
    await saves.write('a', 1);
    expect(await saves.wasEvicted()).toBe(false);

    await backend.delete('a');

    expect(await saves.wasEvicted()).toBe(true);
    expect(await saves.wasEvicted()).toBe(false);
  });

  it('stays false after the game deletes its saves', async () => {
    const saves = create();
    await saves.write('a', 1);
    await saves.delete('a');
    expect(await saves.wasEvicted()).toBe(false);
  });

  it('stays false for a new player', async () => {
    expect(await create().wasEvicted()).toBe(false);
  });
});

describe('sdk.saves', () => {
  it('works in mock mode by default and is reported as available', async () => {
    const sdk = await createMockSdk();
    expect(sdk.features.has('saves')).toBe(true);
    await sdk.saves.write('a', 1);
    expect((await sdk.saves.read('a'))?.data).toBe(1);
  });

  it('throws FEATURE_UNAVAILABLE when a mock excludes it', async () => {
    const sdk = await createMockSdk({ features: [] });
    expect(sdk.features.has('saves')).toBe(false);
    await expectCode(() => sdk.saves, 'FEATURE_UNAVAILABLE');
  });

  it('is unavailable in production without IndexedDB, with no silent memory fallback', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const sdk = await startSdk();
    expect(sdk.features.has('saves')).toBe(false);
    await expectCode(() => sdk.saves, 'FEATURE_UNAVAILABLE');
  });
});

describe('storage info', () => {
  it('reports unknown and false where the API is missing', async () => {
    vi.stubGlobal('navigator', undefined);
    const storage = createBrowserStorageInfo();
    expect(await storage.estimate()).toBe('unknown');
    expect(await storage.isPersistent()).toBe(false);
    expect(await storage.requestPersistence()).toBe(false);
  });

  it('does not throw when the browser rejects', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: () => Promise.reject(new Error('blocked')),
        persist: () => Promise.reject(new Error('blocked')),
      },
    });
    const storage = createBrowserStorageInfo();
    expect(await storage.estimate()).toBe('unknown');
    expect(await storage.requestPersistence()).toBe(false);
  });

  it('converts browser values', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 5, quota: 10 }) } });
    expect(await createBrowserStorageInfo().estimate()).toEqual({ usedBytes: 5, quotaBytes: 10 });
  });

  it('is available on the facade', async () => {
    const sdk = await createMockSdk();
    expect(await sdk.storage.requestPersistence()).toBe(true);
    expect(await sdk.storage.isPersistent()).toBe(true);
  });
});
