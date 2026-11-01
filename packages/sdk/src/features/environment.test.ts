import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeTier, parseUserAgent, readEnvironment, watchDevices } from './environment';
import { Gamingalo } from '../index';

afterEach(async () => {
  vi.unstubAllGlobals();
  try {
    await Gamingalo.instance().shutdown();
  } catch {
    // Nothing was running.
  }
});

describe('computeTier', () => {
  it.each([
    ['unknown', 'unknown', true, true, 'unknown'],
    [2, 16, true, true, 'low'],
    [16, 2, true, true, 'low'],
    [8, 8, false, false, 'low'],
    [8, 8, true, true, 'high'],
    [8, 'unknown', true, true, 'high'],
    ['unknown', 8, true, true, 'medium'],
    [8, 8, false, true, 'medium'],
    [4, 4, true, true, 'medium'],
    [8, 4, true, true, 'medium'],
  ] as const)('cores %s, memory %s, webgpu %s, webgl2 %s is %s', (cores, memory, webgpu, webgl2, tier) => {
    expect(computeTier(cores, memory, webgpu, webgl2)).toBe(tier);
  });
});

describe('parseUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36', 'chrome', '150.0.0.0'],
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36 Edg/150.0.1', 'edge', '150.0.1'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0', 'firefox', '150.0'],
    ['Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.1 Safari/605.1.15', 'safari', '26.1'],
    ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/150.0 Mobile/15E148 Safari/604.1', 'chrome', '150.0'],
    ['something else', 'unknown', 'unknown'],
  ])('parses %s', (userAgent, name, version) => {
    expect(parseUserAgent(userAgent)).toEqual({ name, version });
  });
});

describe('readEnvironment', () => {
  it('returns unknown values when browser APIs are missing', async () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('screen', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('matchMedia', undefined);
    vi.stubGlobal('devicePixelRatio', undefined);

    const env = await readEnvironment();

    expect(env.browser).toEqual({ name: 'unknown', version: 'unknown' });
    expect(env.hardware).toEqual({ cpuCores: 'unknown', memoryGb: 'unknown' });
    expect(env.graphics).toEqual({ webgpu: false, webgl2: false, adapter: 'unknown' });
    expect(env.display.width).toBe('unknown');
    expect(env.devices.gamepads).toBe('unknown');
    expect(env.tier).toBe('unknown');
  });

  it('survives browser APIs that throw', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'x',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      gpu: { requestAdapter: () => Promise.reject(new Error('blocked')) },
      getGamepads: () => {
        throw new Error('blocked');
      },
      mediaDevices: { enumerateDevices: () => Promise.reject(new Error('blocked')) },
    });

    const env = await readEnvironment();

    expect(env.graphics.webgpu).toBe(false);
    expect(env.devices).toEqual({ gamepads: 'unknown', microphones: 'unknown', cameras: 'unknown', speakers: 'unknown' });
  });

  it('counts devices and reads WebGPU adapter details', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'x',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 5,
      gpu: { requestAdapter: async () => ({ info: { vendor: 'acme', architecture: 'gen1' } }) },
      getGamepads: () => [null, {}, null],
      mediaDevices: {
        enumerateDevices: async () => [{ kind: 'audioinput' }, { kind: 'audioinput' }, { kind: 'videoinput' }],
      },
    });

    const env = await readEnvironment();

    expect(env.graphics.webgpu).toBe(true);
    expect(env.graphics.adapter).toEqual({ vendor: 'acme', architecture: 'gen1' });
    expect(env.devices).toEqual({ gamepads: 1, microphones: 2, cameras: 1, speakers: 0 });
    expect(env.display.touch).toBe(true);
  });
});

describe('watchDevices', () => {
  it('reports gamepad changes until stopped', () => {
    const handler = vi.fn();
    const stop = watchDevices(handler);

    window.dispatchEvent(new Event('gamepadconnected'));
    window.dispatchEvent(new Event('gamepaddisconnected'));
    stop();
    window.dispatchEvent(new Event('gamepadconnected'));

    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('sdk.environment', () => {
  it('returns a fixed result in mock mode, with overrides', async () => {
    const sdk = await Gamingalo.init({
      gameId: 'my-game',
      mode: 'mock',
      mock: { environment: { tier: 'low' } },
    });

    const env = await sdk.environment.read();

    expect(env.tier).toBe('low');
    expect(env.browser.name).toBe('chrome');
    expect(env.hardware.cpuCores).toBe(8);
  });

  it('emits devices in production and stops after shutdown', async () => {
    const sdk = await Gamingalo.init({ gameId: 'my-game' });
    const handler = vi.fn();
    sdk.on('devices', handler);

    window.dispatchEvent(new Event('gamepadconnected'));
    expect(handler).toHaveBeenCalledTimes(1);

    await sdk.shutdown();
    window.dispatchEvent(new Event('gamepadconnected'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('can emit devices through mock controls', async () => {
    const sdk = await Gamingalo.init({ gameId: 'my-game', mode: 'mock' });
    const handler = vi.fn();
    sdk.on('devices', handler);
    sdk.mock?.devicesChanged();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
