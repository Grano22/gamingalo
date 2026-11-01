import { GamingaloError } from '@gamingalo/errors';
import { snapshotOwn } from '../config';
import { freeze } from '../primordials';

type Unknown = 'unknown';

export interface NetworkInfo {
  readonly online: boolean;
  readonly effectiveType: string | Unknown;
  readonly downlinkMbps: number | Unknown;
  readonly rttMs: number | Unknown;
  readonly saveData: boolean | Unknown;
}

export interface NetworkMeasurement {
  /** Median round trip of successful requests. */
  readonly pingMs: number | Unknown;
  /** Mean difference between consecutive successful requests. */
  readonly jitterMs: number | Unknown;
  /** Share of HTTP requests that failed. A rough signal, not packet loss. */
  readonly lossPercent: number;
  readonly samples: number;
  /** `unknown` unless `throughputUrl` was given and the download worked. */
  readonly throughputMbps: number | Unknown;
}

export interface MeasureOptions {
  /** Defaults to the current page. Other origins need CORS. */
  url?: string;
  /** A file to download once to estimate throughput. */
  throughputUrl?: string;
  /** Between 1 and 20. Defaults to 5. */
  samples?: number;
  /** Timeout for each request. Between 1 and 60000. Defaults to 5000. */
  timeoutMs?: number;
}

export interface Network {
  /** A random ID, new each time the SDK starts. It doesn't identify the device. */
  readonly sessionId: string;
  info(): NetworkInfo;
  /** Sends requests only when called. Network failures are reported as loss, not rejections. */
  measure(options?: MeasureOptions): Promise<NetworkMeasurement>;
}

const MAX_SAMPLES = 20;

function invalid(message: string): GamingaloError {
  return new GamingaloError('INVALID_ARGUMENT', message);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `times` holds successful round trips in order. */
export function summarizeSamples(times: readonly number[], attempts: number): Omit<NetworkMeasurement, 'throughputMbps'> {
  const lossPercent = attempts === 0 ? 0 : round(((attempts - times.length) / attempts) * 100);
  if (times.length === 0) return { pingMs: 'unknown', jitterMs: 'unknown', lossPercent, samples: attempts };

  const sorted = [...times].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;

  let totalDifference = 0;
  for (let index = 1; index < times.length; index++) {
    totalDifference += Math.abs((times[index] as number) - (times[index - 1] as number));
  }
  const jitter = times.length > 1 ? totalDifference / (times.length - 1) : 0;

  return { pingMs: round(median), jitterMs: round(jitter), lossPercent, samples: attempts };
}

export function computeThroughputMbps(bytes: number, milliseconds: number): number | Unknown {
  if (bytes <= 0 || milliseconds <= 0) return 'unknown';
  return round((bytes * 8) / 1_000_000 / (milliseconds / 1000));
}

function resolveUrl(value: unknown, name: string): string {
  if (typeof value !== 'string') throw invalid(`${name} must be a URL.`);
  let parsed: URL;
  try {
    parsed = new URL(value, typeof location === 'undefined' ? undefined : location.href);
  } catch {
    throw invalid(`${name} must be a valid URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw invalid(`${name} must use http or https.`);
  return parsed.href;
}

function readWholeNumber(value: unknown, name: string, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw invalid(`${name} must be a whole number between 1 and ${max}.`);
  }
  return value;
}

type Fetch = typeof fetch;

export function readNetworkInfo(): NetworkInfo {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const connection = (nav as (Navigator & { connection?: Record<string, unknown> }) | undefined)?.connection;
  const number = (value: unknown) => (typeof value === 'number' ? value : ('unknown' as const));
  return freeze({
    online: nav?.onLine !== false,
    effectiveType: typeof connection?.['effectiveType'] === 'string' ? connection['effectiveType'] : 'unknown',
    downlinkMbps: number(connection?.['downlink']),
    rttMs: number(connection?.['rtt']),
    saveData: typeof connection?.['saveData'] === 'boolean' ? connection['saveData'] : 'unknown',
  });
}

/** `fetchFn` is captured when the SDK starts, so replacing `fetch` later doesn't affect it. */
export function createNetwork(fetchFn: Fetch, sessionId: string, now: () => number = () => performance.now()): Network {
  const request = async (url: string, method: 'HEAD' | 'GET', timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const started = now();
      const response = await fetchFn(url, {
        method,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (!response.ok) return undefined;
      const body = method === 'GET' ? await response.arrayBuffer() : undefined;
      return { milliseconds: now() - started, bytes: body?.byteLength ?? 0 };
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    sessionId,
    info: readNetworkInfo,
    async measure(input) {
      const options = input === undefined ? undefined : snapshotOwn(input);
      if (input !== undefined && !options) throw invalid('measure() options must be an object.');

      const samples = readWholeNumber(options?.['samples'], 'samples', 5, MAX_SAMPLES);
      const timeoutMs = readWholeNumber(options?.['timeoutMs'], 'timeoutMs', 5000, 60000);
      const pageUrl = typeof location === 'undefined' ? undefined : location.href;
      const url = resolveUrl(options?.['url'] ?? pageUrl, 'url');
      const throughputInput = options?.['throughputUrl'];
      const throughputUrl = throughputInput === undefined ? undefined : resolveUrl(throughputInput, 'throughputUrl');

      const times: number[] = [];
      for (let index = 0; index < samples; index++) {
        const result = await request(url, 'HEAD', timeoutMs);
        if (result) times[times.length] = result.milliseconds;
      }

      let throughputMbps: number | Unknown = 'unknown';
      if (throughputUrl) {
        const download = await request(throughputUrl, 'GET', timeoutMs);
        if (download) throughputMbps = computeThroughputMbps(download.bytes, download.milliseconds);
      }
      return freeze({ ...summarizeSamples(times, samples), throughputMbps });
    },
  };
}

/** `randomUUID` only exists on secure origins, and this must not stop a game on plain http. */
export function createSessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let id = '';
  for (let index = 0; index < bytes.length; index++) {
    id += (bytes[index] as number).toString(16).padStart(2, '0');
    if (index === 3 || index === 5 || index === 7 || index === 9) id += '-';
  }
  return id;
}
