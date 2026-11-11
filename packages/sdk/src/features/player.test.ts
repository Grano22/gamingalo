import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gamingalo } from '../index';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { createPlatformBridge } from './player';

const PLATFORM = 'https://play.example';
const profile = { playerId: '6f1b6a4e-2a3b-4c5d-8e9f-0a1b2c3d4e5f', displayName: 'Ada', minor: false, guest: true };

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await stopSdks();
});

/** Pretends the game is in a frame, with a parent that records messages and can reply. */
function embed() {
  const sent: Array<{ message: unknown; target: string }> = [];
  const parent = { postMessage: (message: unknown, target: string) => sent.push({ message, target }) };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
  const reply = (data: unknown, origin = PLATFORM, source: unknown = parent) =>
    window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }));
  const token = (overrides: Record<string, unknown> = {}) =>
    reply({
      type: 'gamingalo:play-token',
      token: 'gmp_secret',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      apiOrigin: 'https://api.example',
      ...overrides,
    });
  return { sent, reply, token };
}

const okFetch = () => vi.fn(async () => new Response(JSON.stringify(profile), { status: 200 }));

describe('platform bridge', () => {
  it('announces itself to the platform origin only', () => {
    const { sent } = embed();
    createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    expect(sent).toEqual([{ message: { type: 'gamingalo:ready' }, target: PLATFORM }]);
  });

  it('reads the profile with the play token, without cookies or referrer', async () => {
    const { token } = embed();
    const fetchFn = okFetch();
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: fetchFn });
    token();

    expect(await bridge.api.profile()).toEqual(profile);
    expect(fetchFn).toHaveBeenCalledWith('https://api.example/v1/game/me', {
      headers: { authorization: 'Bearer gmp_secret' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });

  it('waits for a token that arrives later', async () => {
    const { token } = embed();
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    const pending = bridge.api.profile();
    token();
    expect((await pending).displayName).toBe('Ada');
  });

  it.each([
    ['another origin', { origin: 'https://evil.example' }],
    ['another window', { source: {} }],
  ])('ignores tokens from %s', async (_name, from) => {
    vi.useFakeTimers();
    const { reply } = embed();
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    reply(
      { type: 'gamingalo:play-token', token: 'evil', expiresAt: new Date(Date.now() + 999_999).toISOString(), apiOrigin: 'https://evil.example' },
      (from as { origin?: string }).origin ?? PLATFORM,
      'source' in from ? from.source : undefined,
    );
    const pending = bridge.api.profile();
    vi.advanceTimersByTime(5000);
    await expect(pending).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it.each([
    ['a non-http API origin', { apiOrigin: 'javascript:alert(1)' }],
    ['a missing token', { token: 5 }],
    ['a bad expiry', { expiresAt: 'soon' }],
  ])('ignores a message with %s', async (_name, overrides) => {
    vi.useFakeTimers();
    const { token } = embed();
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    token(overrides);
    const pending = bridge.api.profile();
    vi.advanceTimersByTime(5000);
    await expect(pending).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('asks for a new token when one expires, and retries once after a 401', async () => {
    const { token, sent } = embed();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }));
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: fetchFn as unknown as typeof fetch });
    token();
    const pending = bridge.api.profile();
    await vi.waitFor(() => expect(sent.some((entry) => (entry.message as { type: string }).type === 'gamingalo:token-request')).toBe(true));
    token({ token: 'gmp_fresh' });

    expect((await pending).displayName).toBe('Ada');
    expect(fetchFn).toHaveBeenLastCalledWith('https://api.example/v1/game/me', expect.objectContaining({ headers: { authorization: 'Bearer gmp_fresh' } }));
  });

  it('is unavailable outside a frame', async () => {
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    expect(bridge.api.available()).toBe(false);
    await expect(bridge.api.profile()).rejects.toMatchObject({ code: 'FEATURE_UNAVAILABLE' });
  });

  it('reports network failures and bad responses clearly', async () => {
    const { token } = embed();
    const offline = createPlatformBridge({ platformOrigin: PLATFORM, fetch: vi.fn(async () => Promise.reject(new TypeError('offline'))) });
    token();
    await expect(offline.api.profile()).rejects.toMatchObject({ code: 'NETWORK_OFFLINE' });

    const odd = createPlatformBridge({ platformOrigin: PLATFORM, fetch: vi.fn(async () => new Response('{"playerId":1}')) });
    token();
    await expect(odd.api.profile()).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('stops listening when stopped', async () => {
    vi.useFakeTimers();
    const { token } = embed();
    const bridge = createPlatformBridge({ platformOrigin: PLATFORM, fetch: okFetch() });
    bridge.stop();
    token();
    const pending = bridge.api.profile();
    vi.advanceTimersByTime(5000);
    await expect(pending).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('sdk.player', () => {
  it('needs a platform origin in init', async () => {
    const sdk = await startSdk();
    expect(sdk.features.has('player')).toBe(false);
    expect(() => sdk.player).toThrow(/platform/);
  });

  it('is available inside the platform', async () => {
    embed();
    const sdk = await startSdk({ gameId: 'my-game', platform: { origin: PLATFORM } });
    expect(sdk.features.has('player')).toBe(true);
    expect(Object.isFrozen(sdk.player)).toBe(true);
    expect(Object.keys(sdk.player).sort()).toEqual(['available', 'profile']);
  });

  it.each([
    ['not an origin', 'play.example'],
    ['a path', 'https://play.example/games'],
    ['another scheme', 'ftp://play.example'],
  ])('rejects a platform origin that is %s', async (_name, origin) => {
    await expect(Gamingalo.init({ gameId: 'my-game', platform: { origin } })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('can be simulated in mock mode', async () => {
    const sdk = await createMockSdk({ player: { displayName: 'Mock player' } });
    expect(sdk.player.available()).toBe(true);
    expect(await sdk.player.profile()).toMatchObject({ displayName: 'Mock player', guest: false, minor: false });
    const without = await createMockSdk();
    expect(() => without.player).toThrow(/platform/);
  });
});
