import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamingaloError, Gamingalo, isGamingaloError, readEnvironment, resolveGraphics } from './index';
import { createMemorySaveBackend, createSaves, decodeBlobs, encodeBlobs } from './features/saves';
import { createMemoryStore, createSettings } from './features/settings';
import { startSdk, stopSdks } from './test-helpers';
import { createMockSdk, isTestContext } from './testing';
import * as entry from './index';

const pollutedKeys: string[] = [];

function pollute(key: string, value: unknown): void {
  (Object.prototype as unknown as Record<string, unknown>)[key] = value;
  pollutedKeys.push(key);
}

afterEach(async () => {
  for (const key of pollutedKeys.splice(0)) delete (Object.prototype as unknown as Record<string, unknown>)[key];
  vi.unstubAllGlobals();
  await stopSdks();
});

describe('public surface', () => {
  it('freezes the entry point and its method', () => {
    expect(Object.isFrozen(Gamingalo)).toBe(true);
    expect(Object.isFrozen(Gamingalo.init)).toBe(true);
    expect(Object.getPrototypeOf(Gamingalo)).toBeNull();
  });

  it('freezes standalone exports', () => {
    expect(Object.isFrozen(readEnvironment)).toBe(true);
    expect(Object.isFrozen(resolveGraphics)).toBe(true);
    expect(Object.isFrozen(isGamingaloError)).toBe(true);
    expect(Object.isFrozen(GamingaloError)).toBe(true);
  });

  it('freezes the reference and every feature API, with no prototype', async () => {
    const sdk = await startSdk();
    const apis = [sdk, sdk.features, sdk.connection, sdk.environment, sdk.settings, sdk.session, sdk.cache, sdk.storage];

    for (const api of apis) {
      expect(Object.isFrozen(api)).toBe(true);
      expect(Object.getPrototypeOf(api)).toBeNull();
    }
    expect(Object.isFrozen(sdk.realm)).toBe(true);
    expect(Object.isFrozen(sdk.on)).toBe(true);
    expect(Object.isFrozen(sdk.settings.set)).toBe(true);
  });

  it('rejects overriding, adding and deleting members', async () => {
    const sdk = await startSdk();
    const target = sdk as unknown as Record<string, unknown>;

    expect(() => {
      target['on'] = () => {};
    }).toThrow(TypeError);
    expect(() => {
      target['gameId'] = 'evil';
    }).toThrow(TypeError);
    expect(() => {
      target['extra'] = 1;
    }).toThrow(TypeError);
    expect(() => {
      delete target['settings'];
    }).toThrow(TypeError);
    expect(() => Object.defineProperty(sdk, 'on', { value: () => {} })).toThrow(TypeError);
    expect(() => Object.setPrototypeOf(sdk, {})).toThrow(TypeError);

    expect(sdk.gameId).toBe('my-game');
  });

  it('gives event handlers a frozen payload and no reference through this', async () => {
    const sdk = await createMockSdk();
    let receiver: unknown = 'unset';
    let frozen = false;
    sdk.on('graphics', function (this: unknown, graphics) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- The test checks what `this` is.
      receiver = this;
      frozen = Object.isFrozen(graphics);
    });

    await sdk.settings.setGraphicsPreset('low');

    expect(receiver).toBeUndefined();
    expect(frozen).toBe(true);
  });
});

describe('one reference', () => {
  it('offers no way to look up the running reference', async () => {
    await startSdk();
    expect('instance' in Gamingalo).toBe(false);
    expect(Object.keys(Gamingalo)).toEqual(['init']);
    expect(Object.keys(entry)).not.toContain('instance');
  });

  it('sets no globals', async () => {
    const before = new Set(Reflect.ownKeys(globalThis));
    await startSdk();
    expect(Reflect.ownKeys(globalThis).filter((key) => !before.has(key))).toEqual([]);
  });
});

describe('polluted Object.prototype', () => {
  it('cannot supply gameId', async () => {
    pollute('gameId', 'evil-game');
    await expect(Gamingalo.init({} as never)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('cannot enable mock mode or restrict a realm', async () => {
    pollute('mode', 'mock');
    pollute('mock', {});
    pollute('realm', { origins: ['https://evil.example'] });
    const sdk = await startSdk();
    expect('mock' in sdk).toBe(false);
    expect(sdk.realm.origin).not.toBe('mock');
  });

  it('cannot break the SDK through descriptor fields', async () => {
    // Results are checked after cleaning up, because Vitest's own `expect` breaks under this pollution.
    pollute('get', () => 'evil');
    pollute('set', () => {});
    pollute('value', 'evil');
    const sdk = await startSdk();
    sdk.session.set('a', 1);
    const gameId = sdk.gameId;
    const stored = sdk.session.get('a');
    const encoded = (await encodeBlobs({ level: 2 })) as Record<string, unknown>;
    const level = Object.getOwnPropertyDescriptor(encoded, 'level')?.value as unknown;
    const decodedLevel = Object.getOwnPropertyDescriptor(decodeBlobs(encoded) as object, 'level')?.value as unknown;
    for (const key of pollutedKeys.splice(0)) delete (Object.prototype as unknown as Record<string, unknown>)[key];

    expect({ gameId, stored, level, decodedLevel }).toEqual({ gameId: 'my-game', stored: 1, level: 2, decodedLevel: 2 });
  });

  it('cannot supply a fake clock for saves', async () => {
    const fake = vi.fn(() => 1);
    pollute('now', fake);
    const saves = createSaves({ gameId: 'x', backend: createMemorySaveBackend(), markers: undefined });
    await saves.write('a', 1);
    expect(fake).not.toHaveBeenCalled();
  });

  it('cannot supply realm options inside a real realm object', async () => {
    pollute('origins', ['https://evil.example']);
    pollute('frame', 'embedded');
    const sdk = await startSdk({ gameId: 'my-game', realm: {} });
    expect(sdk.gameId).toBe('my-game');
  });

  it('cannot change stored settings', () => {
    const store = createMemoryStore();
    store.setItem('gamingalo:x:settings', '{}');
    pollute('graphicsPreset', 'low');
    pollute('values', { injected: true });

    const settings = createSettings({ gameId: 'x', store, readTier: async () => 'high', onGraphicsChange: () => {} });

    expect(settings.getGraphicsPreset()).toBe('auto');
    expect(settings.all()).toEqual({});
  });

  it('cannot run a fake migration', async () => {
    const backend = createMemorySaveBackend();
    await backend.put({ slot: 'a', version: 1, updatedAt: 1, data: {} });
    const saves = createSaves({ gameId: 'x', backend, markers: undefined });
    saves.configure({ version: 2 });
    const fake = vi.fn(() => ({ hacked: true }));
    pollute('1', fake);

    await expect(saves.read('a')).rejects.toMatchObject({ code: 'SAVE_MIGRATION_FAILED' });
    expect(fake).not.toHaveBeenCalled();
  });

  it('cannot supply a save schema', () => {
    const saves = createSaves({ gameId: 'x', backend: createMemorySaveBackend(), markers: undefined });
    pollute('version', 5);
    expect(() => saves.configure({} as never)).toThrow(/positive whole number/);
  });

  it('cannot make plain save data look like an encoded Blob', () => {
    pollute('$gamingaloBlob', true);
    const data = { level: 1 };
    expect(decodeBlobs(data)).toEqual({ level: 1 });
  });
});

describe('built-ins patched after load', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not expose session values or handlers through Map and Set', async () => {
    // A mock uses memory storage, because happy-dom's fake localStorage uses Map itself.
    const sdk = await createMockSdk();
    const mapSet = vi.spyOn(Map.prototype, 'set');
    const mapGet = vi.spyOn(Map.prototype, 'get');
    const setAdd = vi.spyOn(Set.prototype, 'add');

    sdk.session.set('secret', 'value');
    sdk.session.get('secret');
    sdk.settings.set('volume', 1);
    sdk.on('suspend', () => {});

    expect(mapSet).not.toHaveBeenCalled();
    expect(mapGet).not.toHaveBeenCalled();
    expect(setAdd).not.toHaveBeenCalled();
  });

  it('keeps working when JSON, Object.freeze and Reflect.apply are replaced', async () => {
    const sdk = await startSdk();
    vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('intercepted');
    });
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new Error('intercepted');
    });
    vi.spyOn(Reflect, 'apply').mockImplementation(() => {
      throw new Error('intercepted');
    });
    vi.spyOn(Object, 'freeze').mockImplementation(((value: unknown) => value) as typeof Object.freeze);

    sdk.settings.set('volume', 0.5);

    expect(sdk.settings.get('volume')).toBe(0.5);
    expect(sdk.settings.persistent).toBe(true);
    expect(JSON.stringify).not.toHaveBeenCalled();
    expect(Object.isFrozen(sdk.on('resume', () => {}))).toBe(true);
  });
});

describe('realm', () => {
  it('reports the realm', async () => {
    const canvas = document.createElement('canvas');
    const sdk = await startSdk({ gameId: 'my-game', realm: { canvas } });
    expect(sdk.realm).toMatchObject({ origin: location.origin, embedded: false, canvas });
  });

  it('allows a listed origin', async () => {
    const sdk = await startSdk({ gameId: 'my-game', realm: { origins: ['https://a.example', location.origin] } });
    expect(sdk.gameId).toBe('my-game');
  });

  it('rejects another origin and stays free to start', async () => {
    await expect(
      Gamingalo.init({ gameId: 'my-game', realm: { origins: ['https://a.example'] } }),
    ).rejects.toMatchObject({ code: 'REALM_NOT_ALLOWED' });
    expect((await startSdk()).gameId).toBe('my-game');
  });

  it('checks the frame type', async () => {
    await expect(Gamingalo.init({ gameId: 'my-game', realm: { frame: 'embedded' } })).rejects.toMatchObject({
      code: 'REALM_NOT_ALLOWED',
    });
    expect((await startSdk({ gameId: 'my-game', realm: { frame: 'top' } })).realm.embedded).toBe(false);
  });

  it.each([
    ['a plain object', {}],
    ['a div', 'div'],
  ])('rejects %s as a canvas', async (_name, value) => {
    const canvas = value === 'div' ? document.createElement('div') : value;
    await expect(Gamingalo.init({ gameId: 'my-game', realm: { canvas: canvas as never } })).rejects.toMatchObject({
      code: 'REALM_NOT_ALLOWED',
    });
  });

  it('checks the list it was given, even if the caller changes it later', async () => {
    const origins = [location.origin];
    const pending = Gamingalo.init({ gameId: 'my-game', realm: { origins } });
    origins[0] = 'https://evil.example';
    const sdk = await pending;
    await sdk.shutdown();
  });
});

describe('mock mode', () => {
  it.each([
    ['NODE_ENV=test', { nodeEnv: 'test' }, true],
    ['Vitest', { vitest: 'true' }, true],
    ['Jest', { jestWorker: '1' }, true],
    ['a WebDriver browser', { webdriver: true }, true],
    ['a normal browser', { webdriver: false }, false],
    ['no signals', {}, false],
    ['NODE_ENV=development', { nodeEnv: 'development' }, false],
    ['NODE_ENV=production', { nodeEnv: 'production' }, false],
    ['NODE_ENV=production with test signals', { nodeEnv: 'production', vitest: 'true', webdriver: true }, false],
  ])('%s', (_name, signals, expected) => {
    expect(
      isTestContext({ nodeEnv: undefined, vitest: undefined, jestWorker: undefined, webdriver: undefined, ...signals }),
    ).toBe(expected);
  });

  it('rejects under NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await expect(createMockSdk()).rejects.toMatchObject({ code: 'MOCK_NOT_ALLOWED' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects unknown options', async () => {
    await expect(createMockSdk({ nope: 1 } as never)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await expect(createMockSdk({ connection: 'nope' as never })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await expect(createMockSdk({ features: ['nope' as never] })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('creates independent instances that do not use the single reference', async () => {
    const first = await createMockSdk();
    const second = await createMockSdk();
    first.session.set('a', 1);
    expect(second.session.has('a')).toBe(false);

    const real = await startSdk();
    expect(real.gameId).toBe('my-game');
  });

  it('is frozen too', async () => {
    const sdk = await createMockSdk();
    expect(Object.isFrozen(sdk)).toBe(true);
    expect(Object.isFrozen(sdk.mock)).toBe(true);
  });

  it('makes no network requests and is controlled by the test, not the browser', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const sdk = await createMockSdk({ connection: 'degraded' });
    const suspend = vi.fn();
    const connection = vi.fn();
    sdk.on('suspend', suspend);
    sdk.on('connection', connection);
    expect(sdk.connection.state).toBe('degraded');

    window.dispatchEvent(new Event('online'));
    expect(sdk.connection.state).toBe('degraded');
    expect(suspend).not.toHaveBeenCalled();

    sdk.mock.setConnection('online');
    sdk.mock.suspend();
    expect(connection).toHaveBeenCalledWith('online');
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports configured features', async () => {
    const withSaves = await createMockSdk();
    expect(withSaves.features.has('saves')).toBe(true);
    const withCapture = await createMockSdk({ features: ['capture'] });
    expect(withCapture.features.has('capture')).toBe(true);
    expect(withCapture.features.has('saves')).toBe(false);
    expect(withCapture.features.has('files')).toBe(false);
  });
});
