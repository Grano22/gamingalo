import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gamingalo, type GamingaloPlugin } from '../index';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { createCanvasFilterLayers } from './canvas-filters';

afterEach(async () => {
  await stopSdks();
  localStorage.clear();
});

function counter(name = 'counter'): GamingaloPlugin<{ increment(): number; readonly value: number }> {
  return {
    name,
    setup() {
      let value = 0;
      return {
        increment: () => ++value,
        get value() {
          return value;
        },
      };
    },
  };
}

describe('sdk.use', () => {
  it('returns a frozen plugin API with no prototype', async () => {
    const plugin = counter();
    const sdk = await startSdk({ gameId: 'my-game', plugins: [plugin] });
    const api = sdk.use(plugin);

    expect(api.increment()).toBe(1);
    expect(api.value).toBe(1);
    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.getPrototypeOf(api)).toBeNull();
    expect(() => {
      (api as unknown as Record<string, unknown>)['increment'] = () => 99;
    }).toThrow(TypeError);
  });

  it('throws for a plugin that was not listed', async () => {
    const sdk = await startSdk();
    expect(() => sdk.use(counter())).toThrow(/not listed/);
  });

  it('stops working after shutdown', async () => {
    const plugin = counter();
    const sdk = await startSdk({ gameId: 'my-game', plugins: [plugin] });
    const api = sdk.use(plugin);
    await sdk.shutdown();
    expect(() => api.increment()).toThrow();
    expect(() => sdk.use(plugin)).toThrow();
  });
});

describe('configuration', () => {
  it.each([
    ['not a list', 'nope'],
    ['a non-object', [5]],
    ['a missing name', [{ setup: () => ({}) }]],
    ['an invalid name', [{ name: 'Bad Name', setup: () => ({}) }]],
    ['a missing setup', [{ name: 'a' }]],
    ['a duplicate name', [counter('a'), counter('a')]],
  ])('rejects %s', async (_name, plugins) => {
    await expect(Gamingalo.init({ gameId: 'my-game', plugins: plugins as never })).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
    });
  });

  it('cannot get a plugin from a polluted prototype', async () => {
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['plugins'] = [counter('evil')];
    const setup = vi.fn(() => ({}));
    prototype['setup'] = setup;
    prototype['name'] = 'evil';
    try {
      const sdk = await startSdk();
      expect(setup).not.toHaveBeenCalled();
      await sdk.shutdown();
      await expect(Gamingalo.init({ gameId: 'my-game', plugins: [{}] as never })).rejects.toMatchObject({
        code: 'INVALID_CONFIG',
      });
    } finally {
      delete prototype['plugins'];
      delete prototype['setup'];
      delete prototype['name'];
    }
  });
});

describe('failure', () => {
  it('rejects init, runs earlier cleanups and leaves the SDK free to start', async () => {
    const cleanup = vi.fn();
    const first: GamingaloPlugin = {
      name: 'first',
      setup(context) {
        context.addCleanup(cleanup);
        return {};
      },
    };
    const broken: GamingaloPlugin = {
      name: 'broken',
      setup() {
        throw new Error('plugin bug');
      },
    };

    await expect(Gamingalo.init({ gameId: 'my-game', plugins: [first, broken] })).rejects.toMatchObject({
      code: 'PLUGIN_FAILED',
      message: expect.stringContaining('broken'),
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect((await startSdk()).gameId).toBe('my-game');
  });

  it('rejects a plugin that returns no API', async () => {
    const plugin = { name: 'empty', setup: () => undefined } as unknown as GamingaloPlugin;
    await expect(Gamingalo.init({ gameId: 'my-game', plugins: [plugin] })).rejects.toMatchObject({
      code: 'PLUGIN_FAILED',
    });
    expect((await startSdk()).gameId).toBe('my-game');
  });
});

describe('context', () => {
  it('runs cleanups newest first on shutdown, and survives one that throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const order: string[] = [];
    const plugin: GamingaloPlugin = {
      name: 'cleanups',
      setup(context) {
        context.addCleanup(() => order.push('first'));
        context.addCleanup(() => {
          throw new Error('bug');
        });
        context.addCleanup(() => order.push('last'));
        return {};
      },
    };
    const sdk = await startSdk({ gameId: 'my-game', plugins: [plugin] });
    await sdk.shutdown();
    expect(order).toEqual(['last', 'first']);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('gives each plugin its own preferences, separate from the game', async () => {
    const stores: Record<string, unknown> = {};
    const writer = (name: string): GamingaloPlugin => ({
      name,
      setup(context) {
        context.preferences.set('value', name);
        stores[name] = context.preferences;
        return {};
      },
    });
    const sdk = await startSdk({ gameId: 'my-game', plugins: [writer('a'), writer('b')] });
    sdk.preferences.set('value', 'game');

    expect((stores['a'] as typeof sdk.preferences).get('value')).toBe('a');
    expect((stores['b'] as typeof sdk.preferences).get('value')).toBe('b');
    expect(sdk.preferences.get('value')).toBe('game');
    expect(localStorage.getItem('gamingalo:my-game:plugin:a:preferences')).toContain('"a"');
  });

  it('does not expose the facade controls', async () => {
    let context: object | undefined;
    const plugin: GamingaloPlugin = {
      name: 'inspect',
      setup(received) {
        context = received;
        return {};
      },
    };
    await startSdk({ gameId: 'my-game', plugins: [plugin] });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.keys(context as object).sort()).toEqual([
      'addCleanup',
      'environment',
      'gameId',
      'preferences',
      'realm',
      'setCanvasFilter',
    ]);
  });

  it('works with the mock SDK', async () => {
    const plugin: GamingaloPlugin<{ dim(): void }> = {
      name: 'dimmer',
      setup: (context) => ({ dim: () => context.setCanvasFilter('brightness(0.5)') }),
    };
    const sdk = await createMockSdk({ plugins: [plugin] });
    sdk.use(plugin).dim();
    expect(sdk.mock.canvasFilter()).toBe('brightness(0.5)');
  });
});

describe('canvas filter layers', () => {
  it('combines layers with the original filter, and removes them', () => {
    const canvas = document.createElement('canvas');
    canvas.style.filter = 'blur(1px)';
    const layers = createCanvasFilterLayers(canvas);

    layers.set('a', 'brightness(2)');
    layers.set('b', 'grayscale(1)');
    expect(canvas.style.filter).toBe('blur(1px) brightness(2) grayscale(1)');

    layers.set('a', '');
    expect(canvas.style.filter).toBe('blur(1px) grayscale(1)');
  });

  it('restores the original, and ignores later changes', () => {
    const canvas = document.createElement('canvas');
    const layers = createCanvasFilterLayers(canvas);
    layers.set('a', 'brightness(2)');
    layers.dispose();
    layers.set('a', 'brightness(3)');
    expect(canvas.style.filter).toBe('');
  });

  it('keeps plugin and accessibility filters together on a real SDK', async () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const plugin: GamingaloPlugin<{ dim(): void }> = {
      name: 'dimmer',
      setup: (context) => ({ dim: () => context.setCanvasFilter('brightness(0.5)') }),
    };
    const sdk = await startSdk({ gameId: 'my-game', realm: { canvas }, plugins: [plugin], modules: ['accessibility'] });

    sdk.use(plugin).dim();
    sdk.accessibility.setCanvasFilter('grayscale');
    expect(canvas.style.filter).toContain('brightness(0.5)');
    expect(canvas.style.filter).toContain('grayscale(1)');

    sdk.accessibility.setCanvasFilter('none');
    expect(canvas.style.filter).toBe('brightness(0.5)');

    await sdk.shutdown();
    expect(canvas.style.filter).toBe('');
    canvas.remove();
  });
});
