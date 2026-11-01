import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gamingalo, isGamingaloError, type ErrorCode, type GamingaloSdk } from './index';

const GAME = { gameId: 'my-game' };

async function expectCode(action: () => unknown, code: ErrorCode): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(isGamingaloError(error) && error.code).toBe(code);
    return;
  }
  throw new Error(`Expected error ${code}, but nothing was thrown`);
}

function setVisibility(state: DocumentVisibilityState): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(async () => {
  try {
    await Gamingalo.instance().shutdown();
  } catch {
    // Nothing was running.
  }
});

describe('init', () => {
  it('returns the same instance for the same configuration', async () => {
    const first = await Gamingalo.init(GAME);
    expect(await Gamingalo.init({ ...GAME })).toBe(first);
    expect(Gamingalo.instance()).toBe(first);
  });

  it('treats mock features as equal regardless of order and duplicates', async () => {
    const first = await Gamingalo.init({ ...GAME, mode: 'mock', mock: { features: ['saves', 'capture'] } });
    const second = await Gamingalo.init({ ...GAME, mode: 'mock', mock: { features: ['capture', 'saves', 'saves'] } });
    expect(second).toBe(first);
  });

  it('returns one instance for concurrent calls', async () => {
    const [first, second] = await Promise.all([Gamingalo.init(GAME), Gamingalo.init(GAME)]);
    expect(first).toBe(second);
  });

  it('rejects a different configuration', async () => {
    await Gamingalo.init(GAME);
    await expectCode(() => Gamingalo.init({ gameId: 'other-game' }), 'SDK_ALREADY_INITIALIZED');
  });

  it.each([
    ['missing gameId', {}],
    ['uppercase gameId', { gameId: 'My-Game' }],
    ['unknown mode', { gameId: 'x', mode: 'staging' }],
    ['unknown key', { gameId: 'x', extra: true }],
    ['mock options outside mock mode', { gameId: 'x', mock: {} }],
    ['unknown mock feature', { gameId: 'x', mode: 'mock', mock: { features: ['nope'] } }],
    ['not an object', null],
  ])('rejects %s', async (_name, config) => {
    await expectCode(() => Gamingalo.init(config as never), 'INVALID_CONFIG');
  });

  it('leaves nothing running after an invalid configuration', async () => {
    await expectCode(() => Gamingalo.init({ gameId: '' }), 'INVALID_CONFIG');
    await expectCode(() => Gamingalo.instance(), 'SDK_NOT_INITIALIZED');
  });

  it('succeeds while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const sdk = await Gamingalo.init(GAME);
    expect(sdk.connection.state).toBe('offline');
  });

  it('defaults to production mode with no mock controls', async () => {
    const sdk = await Gamingalo.init(GAME);
    expect(sdk.gameId).toBe('my-game');
    expect(sdk.mode).toBe('production');
    expect(sdk.mock).toBeUndefined();
  });
});

describe('shutdown', () => {
  it('throws SDK_NOT_INITIALIZED when no instance is running', async () => {
    await expectCode(() => Gamingalo.instance(), 'SDK_NOT_INITIALIZED');
  });

  it('makes every member throw except a repeated shutdown', async () => {
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock' });
    const { features, connection, mock } = sdk;
    await sdk.shutdown();

    await expect(sdk.shutdown()).resolves.toBeUndefined();
    await expectCode(() => sdk.gameId, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.mode, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.features, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.connection, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.mock, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.on('resume', () => {}), 'SDK_NOT_INITIALIZED');
    await expectCode(() => features.has('saves'), 'SDK_NOT_INITIALIZED');
    await expectCode(() => connection.state, 'SDK_NOT_INITIALIZED');
    await expectCode(() => mock?.suspend(), 'SDK_NOT_INITIALIZED');
  });

  it('stops listening to browser events', async () => {
    const sdk = await Gamingalo.init(GAME);
    const handler = vi.fn();
    sdk.on('suspend', handler);
    await sdk.shutdown();

    setVisibility('hidden');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a new instance with a different configuration', async () => {
    const first = await Gamingalo.init(GAME);
    await first.shutdown();
    const second = await Gamingalo.init({ gameId: 'other-game' });
    expect(second).not.toBe(first);
    expect(second.gameId).toBe('other-game');
  });
});

describe('lifecycle events', () => {
  async function start(): Promise<{ sdk: GamingaloSdk; suspend: () => void; resume: () => void }> {
    const sdk = await Gamingalo.init(GAME);
    const suspend = vi.fn();
    const resume = vi.fn();
    sdk.on('suspend', suspend);
    sdk.on('resume', resume);
    return { sdk, suspend, resume };
  }

  it('fires suspend and resume when visibility changes', async () => {
    const { suspend, resume } = await start();

    setVisibility('hidden');
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('fires once when several browser events report one transition', async () => {
    const { suspend, resume } = await start();

    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('freeze'));
    expect(suspend).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('resume'));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('does not resume on pageshow while the page is hidden', async () => {
    const { resume } = await start();
    setVisibility('hidden');
    window.dispatchEvent(new Event('pageshow'));
    expect(resume).not.toHaveBeenCalled();
  });

  it('fires resume when started in a hidden tab and then shown', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { suspend, resume } = await start();
    expect(suspend).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(resume).toHaveBeenCalledTimes(1);
  });
});

describe('events', () => {
  it('stops calling a handler after it unsubscribes', async () => {
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock' });
    const handler = vi.fn();
    const off = sdk.on('suspend', handler);
    off();
    sdk.mock?.suspend();
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps calling other handlers when one throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock' });
    const after = vi.fn();
    sdk.on('suspend', () => {
      throw new Error('game bug');
    });
    sdk.on('suspend', after);

    sdk.mock?.suspend();
    expect(after).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('connection', () => {
  it('follows browser online and offline events', async () => {
    const sdk = await Gamingalo.init(GAME);
    const handler = vi.fn();
    sdk.on('connection', handler);

    window.dispatchEvent(new Event('offline'));
    expect(sdk.connection.state).toBe('offline');
    window.dispatchEvent(new Event('online'));
    expect(sdk.connection.state).toBe('online');

    expect(handler.mock.calls).toEqual([['offline'], ['online']]);
  });

  it('does not fire when the state is unchanged', async () => {
    const sdk = await Gamingalo.init(GAME);
    const handler = vi.fn();
    sdk.on('connection', handler);
    window.dispatchEvent(new Event('online'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps a connection object live as the state changes', async () => {
    const sdk = await Gamingalo.init(GAME);
    const connection = sdk.connection;
    window.dispatchEvent(new Event('offline'));
    expect(connection.state).toBe('offline');
  });
});

describe('features', () => {
  it('reports nothing as available in production for now, without throwing', async () => {
    const sdk = await Gamingalo.init(GAME);
    expect(sdk.features.has('saves')).toBe(false);
    expect(sdk.features.has('not-a-feature')).toBe(false);
  });

  it('reports configured mock features', async () => {
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock', mock: { features: ['saves'] } });
    expect(sdk.features.has('saves')).toBe(true);
    expect(sdk.features.has('capture')).toBe(false);
  });
});

describe('mock mode', () => {
  it('makes no network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock' });
    sdk.mock?.setConnection('offline');
    await sdk.shutdown();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is controlled by the test, not the browser', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const sdk = await Gamingalo.init({ ...GAME, mode: 'mock', mock: { connection: 'degraded' } });
    const suspend = vi.fn();
    const connection = vi.fn();
    sdk.on('suspend', suspend);
    sdk.on('connection', connection);
    expect(sdk.connection.state).toBe('degraded');

    window.dispatchEvent(new Event('online'));
    setVisibility('hidden');
    expect(sdk.connection.state).toBe('degraded');
    expect(suspend).not.toHaveBeenCalled();

    sdk.mock?.setConnection('online');
    sdk.mock?.suspend();
    expect(connection).toHaveBeenCalledWith('online');
    expect(suspend).toHaveBeenCalledTimes(1);
  });
});
