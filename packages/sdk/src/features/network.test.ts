import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { computeThroughputMbps, createNetwork, createSessionId, readNetworkInfo, summarizeSamples } from './network';

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
});

function clock(step = 10): () => number {
  let time = 0;
  return () => (time += step);
}

describe('summarizeSamples', () => {
  it('uses the median, so one slow request has little effect', () => {
    expect(summarizeSamples([10, 12, 500, 11, 13], 5).pingMs).toBe(12);
  });

  it('averages the two middle values for an even count', () => {
    expect(summarizeSamples([10, 20, 30, 40], 4).pingMs).toBe(25);
  });

  it('computes jitter from consecutive samples, in order', () => {
    expect(summarizeSamples([10, 20, 10, 20], 4).jitterMs).toBe(10);
    expect(summarizeSamples([10, 10, 20, 20], 4).jitterMs).toBeCloseTo(3.33, 2);
    expect(summarizeSamples([10], 1).jitterMs).toBe(0);
  });

  it('computes loss, and reports unknown when everything fails', () => {
    expect(summarizeSamples([10, 10, 10], 4).lossPercent).toBe(25);
    expect(summarizeSamples([], 3)).toEqual({ pingMs: 'unknown', jitterMs: 'unknown', lossPercent: 100, samples: 3 });
  });
});

describe('computeThroughputMbps', () => {
  it('converts bytes and time to megabits per second', () => {
    expect(computeThroughputMbps(1_000_000, 1000)).toBe(8);
    expect(computeThroughputMbps(125_000, 100)).toBe(10);
  });

  it('is unknown for no data or no time', () => {
    expect(computeThroughputMbps(0, 100)).toBe('unknown');
    expect(computeThroughputMbps(100, 0)).toBe('unknown');
  });
});

describe('measure', () => {
  it('sends private, uncached requests', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const network = createNetwork(fetchFn as typeof fetch, 'id', clock());

    const result = await network.measure({ url: 'https://a.example/ping', samples: 2 });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://a.example/ping',
      expect.objectContaining({ method: 'HEAD', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }),
    );
    expect(result).toEqual({ pingMs: 10, jitterMs: 0, lossPercent: 0, samples: 2, throughputMbps: 'unknown' });
  });

  it('counts HTTP errors and network failures as loss, without rejecting', async () => {
    const responses = [
      async () => new Response(null, { status: 500 }),
      async () => {
        throw new TypeError('offline');
      },
      async () => new Response(null, { status: 200 }),
      async () => new Response(null, { status: 200 }),
    ];
    let call = 0;
    const fetchFn = (async () => (responses[call++] as () => Promise<Response>)()) as typeof fetch;

    const result = await createNetwork(fetchFn, 'id', clock()).measure({ url: 'https://a.example', samples: 4 });

    expect(result.lossPercent).toBe(50);
    expect(result.pingMs).toBe(10);
  });

  it('measures throughput from one download', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === 'GET' ? new Response(new Uint8Array(1_000_000)) : new Response(null),
    );
    const network = createNetwork(fetchFn as unknown as typeof fetch, 'id', clock(1000));

    const result = await network.measure({
      url: 'https://a.example/ping',
      throughputUrl: 'https://a.example/file',
      samples: 1,
    });

    expect(result.throughputMbps).toBe(8);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('times out slow requests as loss', async () => {
    const fetchFn = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
      })) as unknown as typeof fetch;

    const result = await createNetwork(fetchFn, 'id').measure({
      url: 'https://a.example',
      samples: 1,
      timeoutMs: 5,
    });

    expect(result.lossPercent).toBe(100);
  });

  it.each([
    ['a non-http url', { url: 'file:///etc/passwd' }],
    ['a javascript url', { url: 'javascript:alert(1)' }],
    ['a non-string url', { url: 5 }],
    ['zero samples', { samples: 0 }],
    ['too many samples', { samples: 21 }],
    ['fractional samples', { samples: 1.5 }],
    ['a bad timeout', { timeoutMs: 0 }],
    ['a bad throughput url', { throughputUrl: 'ftp://a.example/file' }],
    ['options that are not an object', 5],
  ])('rejects %s and sends nothing', async (_name, options) => {
    const fetchFn = vi.fn();
    await expect(createNetwork(fetchFn as never, 'id').measure(options as never)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('ignores options from a polluted prototype', async () => {
    const fetchFn = vi.fn(async () => new Response(null));
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['url'] = 'https://evil.example/steal';
    prototype['samples'] = 1;
    try {
      await createNetwork(fetchFn as typeof fetch, 'id', clock()).measure();
    } finally {
      delete prototype['url'];
      delete prototype['samples'];
    }
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect((fetchFn.mock.calls as unknown as string[][])[0]?.[0]).not.toContain('evil.example');
  });
});

describe('info', () => {
  it('reads browser values', () => {
    vi.stubGlobal('navigator', { onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false } });
    expect(readNetworkInfo()).toEqual({ online: true, effectiveType: '4g', downlinkMbps: 10, rttMs: 50, saveData: false });
  });

  it('reports unknown where the browser has no connection info', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(readNetworkInfo()).toEqual({
      online: false,
      effectiveType: 'unknown',
      downlinkMbps: 'unknown',
      rttMs: 'unknown',
      saveData: 'unknown',
    });
  });
});

describe('createSessionId', () => {
  it('works without randomUUID, as on an insecure origin', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
    expect(createSessionId()).toBe('abababab-abab-abab-abab-abababababab');
  });
});

describe('sdk.network', () => {
  it('gives each SDK start a new random session ID, and sends nothing until asked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const first = await startSdk();
    const firstId = first.network.sessionId;
    await first.shutdown();
    const second = await startSdk();

    expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.network.sessionId === firstId).toBe(false);
    second.network.info();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('contains no address information', async () => {
    const sdk = await createMockSdk();
    const fields = [...Object.keys(sdk.network.info()), ...Object.keys(await sdk.network.measure()), ...Object.keys(sdk.network)];
    expect(fields.filter((field) => /ip|mac|address/i.test(field))).toEqual([]);
  });

  it('returns configured values in mock mode, with no network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sdk = await createMockSdk({ network: { pingMs: 200, lossPercent: 10 } });

    const result = await sdk.network.measure();

    expect(result).toMatchObject({ pingMs: 200, lossPercent: 10, jitterMs: 2 });
    expect(fetchSpy).not.toHaveBeenCalled();

    sdk.mock.setNetwork({ pingMs: 5 });
    expect((await sdk.network.measure()).pingMs).toBe(5);
  });

  it('follows the mock connection state in info', async () => {
    const sdk = await createMockSdk({ connection: 'offline' });
    expect(sdk.network.info().online).toBe(false);
    sdk.mock.setConnection('online');
    expect(sdk.network.info().online).toBe(true);
  });
});
