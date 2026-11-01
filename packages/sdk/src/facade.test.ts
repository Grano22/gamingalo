import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gamingalo, isGamingaloError, type ErrorCode, type GamingaloSdk } from './index';
import { startSdk, stopSdks } from './test-helpers';
import { createMockSdk } from './testing';

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

afterEach(stopSdks);

describe('init', () => {
  it('gives out only one reference, even for the same configuration', async () => {
    await startSdk(GAME);
    await expectCode(() => Gamingalo.init(GAME), 'SDK_ALREADY_INITIALIZED');
    await expectCode(() => Gamingalo.init({ gameId: 'other-game' }), 'SDK_ALREADY_INITIALIZED');
  });

  it('gives out one reference for concurrent calls', async () => {
    const results = await Promise.allSettled([Gamingalo.init(GAME), Gamingalo.init(GAME)]);
    const [first, second] = results;
    expect(first?.status).toBe('fulfilled');
    expect(second?.status).toBe('rejected');
    if (first?.status === 'fulfilled') await first.value.shutdown();
  });

  it.each([
    ['missing gameId', {}],
    ['uppercase gameId', { gameId: 'My-Game' }],
    ['unknown key', { gameId: 'x', extra: true }],
    ['mock mode', { gameId: 'x', mode: 'mock' }],
    ['mock options', { gameId: 'x', mock: {} }],
    ['an invalid frame', { gameId: 'x', realm: { frame: 'nope' } }],
    ['a non-array origins value', { gameId: 'x', realm: { origins: 'https://a.example' } }],
    ['a realm that is not an object', { gameId: 'x', realm: 5 }],
    ['not an object', null],
  ])('rejects %s', async (_name, config) => {
    await expectCode(() => Gamingalo.init(config as never), 'INVALID_CONFIG');
  });

  it('can start after an invalid configuration', async () => {
    await expectCode(() => Gamingalo.init({ gameId: '' }), 'INVALID_CONFIG');
    expect((await startSdk(GAME)).gameId).toBe('my-game');
  });

  it('succeeds while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const sdk = await startSdk(GAME);
    expect(sdk.connection.state).toBe('offline');
  });

  it('has no mock members in production', async () => {
    const sdk = await startSdk(GAME);
    expect('mock' in sdk).toBe(false);
    expect('mode' in sdk).toBe(false);
  });
});

describe('shutdown', () => {
  it('makes every member throw except a repeated shutdown', async () => {
    const sdk = await createMockSdk();
    const { features, connection, mock, saves } = sdk;
    await sdk.shutdown();

    await expect(sdk.shutdown()).resolves.toBeUndefined();
    await expectCode(() => sdk.gameId, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.features, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.connection, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.mock, 'SDK_NOT_INITIALIZED');
    await expectCode(() => sdk.on('resume', () => {}), 'SDK_NOT_INITIALIZED');
    await expectCode(() => features.has('saves'), 'SDK_NOT_INITIALIZED');
    await expectCode(() => connection.state, 'SDK_NOT_INITIALIZED');
    await expectCode(() => mock.suspend(), 'SDK_NOT_INITIALIZED');
    await expectCode(() => saves.list(), 'SDK_NOT_INITIALIZED');
  });

  it('stops listening to browser events', async () => {
    const sdk = await startSdk(GAME);
    const handler = vi.fn();
    sdk.on('suspend', handler);
    await sdk.shutdown();

    setVisibility('hidden');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a new instance with a different configuration', async () => {
    const first = await startSdk(GAME);
    await first.shutdown();
    const second = await startSdk({ gameId: 'other-game' });
    expect(second === first).toBe(false);
    expect(second.gameId).toBe('other-game');
  });
});

describe('lifecycle events', () => {
  async function start(): Promise<{ sdk: GamingaloSdk; suspend: () => void; resume: () => void }> {
    const sdk = await startSdk(GAME);
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
    const sdk = await createMockSdk();
    const handler = vi.fn();
    const off = sdk.on('suspend', handler);
    off();
    sdk.mock.suspend();
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps calling other handlers when one throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sdk = await createMockSdk();
    const after = vi.fn();
    sdk.on('suspend', () => {
      throw new Error('game bug');
    });
    sdk.on('suspend', after);

    sdk.mock.suspend();
    expect(after).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an unknown event', 'nope', () => {}],
    ['a prototype key', '__proto__', () => {}],
    ['a missing handler', 'suspend', undefined],
  ])('rejects %s', async (_name, event, handler) => {
    const sdk = await createMockSdk();
    await expectCode(() => sdk.on(event as never, handler as never), 'INVALID_ARGUMENT');
  });
});

describe('connection', () => {
  it('follows browser online and offline events', async () => {
    const sdk = await startSdk(GAME);
    const handler = vi.fn();
    sdk.on('connection', handler);

    window.dispatchEvent(new Event('offline'));
    expect(sdk.connection.state).toBe('offline');
    window.dispatchEvent(new Event('online'));
    expect(sdk.connection.state).toBe('online');

    expect(handler.mock.calls).toEqual([['offline'], ['online']]);
  });

  it('does not fire when the state is unchanged', async () => {
    const sdk = await startSdk(GAME);
    const handler = vi.fn();
    sdk.on('connection', handler);
    window.dispatchEvent(new Event('online'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps a connection object live as the state changes', async () => {
    const sdk = await startSdk(GAME);
    const connection = sdk.connection;
    window.dispatchEvent(new Event('offline'));
    expect(connection.state).toBe('offline');
  });
});

describe('features', () => {
  it('reports what is available without throwing', async () => {
    const sdk = await startSdk(GAME);
    expect(sdk.features.has('capture')).toBe(false);
    expect(sdk.features.has('not-a-feature')).toBe(false);
  });
});
