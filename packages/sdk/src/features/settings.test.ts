import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gamingalo, isGamingaloError } from '../index';
import {
  createMemoryStore,
  createSettings,
  getBrowserStore,
  resolveGraphics,
  type KeyValueStore,
  type Settings,
} from './settings';

function create(store: KeyValueStore | undefined = createMemoryStore(), gameId = 'my-game'): Settings {
  return createSettings({ gameId, store, readTier: async () => 'high', onGraphicsChange: () => {} });
}

function expectInvalid(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    expect(isGamingaloError(error) && error.code).toBe('INVALID_ARGUMENT');
    return;
  }
  throw new Error('Expected INVALID_ARGUMENT');
}

afterEach(async () => {
  vi.unstubAllGlobals();
  try {
    await Gamingalo.instance().shutdown();
  } catch {
    // Nothing was running.
  }
});

describe('custom settings', () => {
  it('stores, reads and removes values', () => {
    const settings = create();
    settings.set('volume', 0.5);
    settings.set('keys', { jump: 'Space' });

    expect(settings.get('volume')).toBe(0.5);
    expect(settings.get('missing')).toBeUndefined();
    expect(settings.get('missing', 1)).toBe(1);
    expect(settings.all()).toEqual({ volume: 0.5, keys: { jump: 'Space' } });

    settings.remove('volume');
    expect(settings.get('volume', 1)).toBe(1);
  });

  it('survives being created again from the same store', () => {
    const store = createMemoryStore();
    create(store).set('volume', 0.5);
    expect(create(store).get('volume')).toBe(0.5);
  });

  it('keeps games separate', () => {
    const store = createMemoryStore();
    create(store, 'game-a').set('volume', 0.5);
    expect(create(store, 'game-b').get('volume')).toBeUndefined();
  });

  it('does not let callers change stored values through a reference', () => {
    const settings = create();
    const input = { level: 1 };
    settings.set('progress', input);
    input.level = 2;
    (settings.get('progress') as { level: number }).level = 3;
    expect(settings.get('progress')).toEqual({ level: 1 });
  });

  it('handles a key that could pollute prototypes', () => {
    const store = createMemoryStore();
    create(store).set('__proto__', 'x');
    expect(create(store).get('__proto__')).toBe('x');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['a function', () => {}],
    ['NaN', Number.NaN],
    ['a date', new Date()],
    ['a nested map', { value: new Map() }],
  ])('rejects %s', (_name, value) => {
    expectInvalid(() => create().set('key', value as never));
  });

  it('rejects a circular value and an empty key', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expectInvalid(() => create().set('key', circular as never));
    expectInvalid(() => create().set('', 1));
  });
});

describe('storage problems', () => {
  it('treats corrupted data as empty', () => {
    const store = createMemoryStore();
    store.setItem('gamingalo:my-game:settings', '{not json');
    const settings = create(store);
    expect(settings.all()).toEqual({});
    expect(settings.getGraphicsPreset()).toBe('auto');
  });

  it('ignores stored values with the wrong shape', () => {
    const store = createMemoryStore();
    store.setItem('gamingalo:my-game:settings', JSON.stringify({ values: 5, graphicsPreset: 'ultra' }));
    const settings = create(store);
    expect(settings.all()).toEqual({});
    expect(settings.getGraphicsPreset()).toBe('auto');
  });

  it('keeps values in memory when a write fails, and reports it', () => {
    const settings = create({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    expect(settings.persistent).toBe(true);

    settings.set('volume', 0.5);

    expect(settings.get('volume')).toBe(0.5);
    expect(settings.persistent).toBe(false);
  });

  it('works when reading storage throws', () => {
    const settings = create({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(settings.all()).toEqual({});
  });

  it('reports no persistence without a store', () => {
    const settings = createSettings({
      gameId: 'x',
      store: undefined,
      readTier: async () => 'high',
      onGraphicsChange: () => {},
    });
    settings.set('volume', 1);
    expect(settings.persistent).toBe(false);
    expect(settings.get('volume')).toBe(1);
  });

  it('getBrowserStore returns undefined when access throws', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getBrowserStore()).toBeUndefined();
  });
});

describe('graphics', () => {
  it.each([
    ['auto', 'low', 'low'],
    ['auto', 'high', 'high'],
    ['auto', 'unknown', 'medium'],
    ['low', 'high', 'low'],
    ['high', 'low', 'high'],
  ] as const)('preset %s on tier %s gives %s', (preset, tier, quality) => {
    expect(resolveGraphics(preset, tier)).toMatchObject({ preset, quality });
  });

  it('saves the preset and notifies with resolved values', async () => {
    const store = createMemoryStore();
    const onGraphicsChange = vi.fn();
    const settings = createSettings({ gameId: 'x', store, readTier: async () => 'high', onGraphicsChange });

    const result = await settings.setGraphicsPreset('low');

    expect(result.quality).toBe('low');
    expect(result.targetFps).toBe(30);
    expect(onGraphicsChange).toHaveBeenCalledWith(result);
    expect(
      createSettings({ gameId: 'x', store, readTier: async () => 'high', onGraphicsChange }).getGraphicsPreset(),
    ).toBe('low');
  });

  it('rejects an unknown preset', async () => {
    await expect(create().setGraphicsPreset('ultra' as never)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

describe('sdk.settings', () => {
  it('uses the environment tier and emits graphics', async () => {
    const sdk = await Gamingalo.init({ gameId: 'my-game', mode: 'mock', mock: { environment: { tier: 'low' } } });
    const handler = vi.fn();
    sdk.on('graphics', handler);

    expect((await sdk.settings.getGraphics()).quality).toBe('low');
    await sdk.settings.setGraphicsPreset('high');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ quality: 'high' }));
  });

  it('does not touch browser storage in mock mode', async () => {
    const sdk = await Gamingalo.init({ gameId: 'my-game', mode: 'mock' });
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    sdk.settings.set('volume', 1);
    expect(spy).not.toHaveBeenCalled();
    expect(sdk.settings.get('volume')).toBe(1);
  });

  it('throws after shutdown', async () => {
    const sdk = await Gamingalo.init({ gameId: 'my-game', mode: 'mock' });
    const settings = sdk.settings;
    await sdk.shutdown();
    expect(() => settings.get('volume')).toThrow();
    expect(() => sdk.settings).toThrow();
  });
});
