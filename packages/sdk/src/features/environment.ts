export type Unknown = 'unknown';
export type CapabilityTier = 'low' | 'medium' | 'high' | Unknown;
export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'safari' | Unknown;

export interface EnvironmentInfo {
  browser: { name: BrowserName; version: string | Unknown };
  platform: { os: string | Unknown; mobile: boolean | Unknown; installedPwa: boolean };
  hardware: { cpuCores: number | Unknown; memoryGb: number | Unknown };
  graphics: {
    webgpu: boolean;
    webgl2: boolean;
    adapter: { vendor: string; architecture: string } | Unknown;
  };
  display: {
    width: number | Unknown;
    height: number | Unknown;
    pixelRatio: number | Unknown;
    colorDepth: number | Unknown;
    hdr: boolean;
    multipleDisplays: boolean | Unknown;
    touch: boolean;
  };
  devices: {
    gamepads: number | Unknown;
    microphones: number | Unknown;
    cameras: number | Unknown;
    speakers: number | Unknown;
  };
  tier: CapabilityTier;
}

export interface Environment {
  /** Reads current values. Missing browser APIs produce `unknown`, never an error. */
  read(): Promise<EnvironmentInfo>;
}

export function computeTier(
  cpuCores: number | Unknown,
  memoryGb: number | Unknown,
  webgpu: boolean,
  webgl2: boolean,
): CapabilityTier {
  if (cpuCores === 'unknown' && memoryGb === 'unknown') return 'unknown';
  const belowMinimum = (value: number | Unknown) => value !== 'unknown' && value < 4;
  if (belowMinimum(cpuCores) || belowMinimum(memoryGb) || (!webgpu && !webgl2)) return 'low';

  const enoughCores = cpuCores !== 'unknown' && cpuCores >= 8;
  const enoughMemory = memoryGb === 'unknown' || memoryGb >= 8;
  return webgpu && enoughCores && enoughMemory ? 'high' : 'medium';
}

/** Parses a user agent string. Order matters: Edge and Chrome UAs also mention Safari. */
export function parseUserAgent(userAgent: string): EnvironmentInfo['browser'] {
  const patterns: Array<[BrowserName, RegExp]> = [
    ['edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['safari', /Version\/([\d.]+).*Safari\//],
  ];
  for (const [name, pattern] of patterns) {
    const version = pattern.exec(userAgent)?.[1];
    if (version) return { name, version };
  }
  return { name: 'unknown', version: 'unknown' };
}

interface NavigatorExtras {
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean; platform?: string };
  gpu?: { requestAdapter(): Promise<{ info?: { vendor?: string; architecture?: string } } | null> };
}

function positiveNumber(value: unknown): number | Unknown {
  return typeof value === 'number' && value > 0 ? value : 'unknown';
}

function mediaQuery(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

async function readGraphics(gpu: NavigatorExtras['gpu']): Promise<EnvironmentInfo['graphics']> {
  let webgpu = false;
  let adapter: EnvironmentInfo['graphics']['adapter'] = 'unknown';
  try {
    const found = await gpu?.requestAdapter();
    if (found) {
      webgpu = true;
      if (found.info?.vendor || found.info?.architecture) {
        adapter = { vendor: found.info.vendor ?? '', architecture: found.info.architecture ?? '' };
      }
    }
  } catch {
    // Treated as no WebGPU.
  }

  let webgl2 = false;
  try {
    if (typeof document !== 'undefined') {
      const context = document.createElement('canvas').getContext('webgl2');
      webgl2 = !!context;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Treated as no WebGL2.
  }
  return { webgpu, webgl2, adapter };
}

async function readDevices(): Promise<EnvironmentInfo['devices']> {
  const devices: EnvironmentInfo['devices'] = {
    gamepads: 'unknown',
    microphones: 'unknown',
    cameras: 'unknown',
    speakers: 'unknown',
  };
  if (typeof navigator === 'undefined') return devices;

  try {
    if (typeof navigator.getGamepads === 'function') {
      devices.gamepads = navigator.getGamepads().filter(Boolean).length;
    }
  } catch {
    // Blocked by permissions policy.
  }
  try {
    const media = await navigator.mediaDevices?.enumerateDevices();
    if (media) {
      const count = (kind: MediaDeviceKind) => media.filter((device) => device.kind === kind).length;
      devices.microphones = count('audioinput');
      devices.cameras = count('videoinput');
      devices.speakers = count('audiooutput');
    }
  } catch {
    // Blocked by permissions policy.
  }
  return devices;
}

export const readEnvironment = Object.freeze(async function readEnvironment(): Promise<EnvironmentInfo> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const extras = nav as (Navigator & NavigatorExtras) | undefined;
  const display = typeof screen === 'undefined' ? undefined : screen;
  const uaData = extras?.userAgentData;

  const graphics = await readGraphics(extras?.gpu);
  const cpuCores = positiveNumber(nav?.hardwareConcurrency);
  const memoryGb = positiveNumber(extras?.deviceMemory);
  const isExtended = (display as (Screen & { isExtended?: boolean }) | undefined)?.isExtended;

  return {
    browser: nav ? parseUserAgent(nav.userAgent) : { name: 'unknown', version: 'unknown' },
    platform: {
      os: uaData?.platform || 'unknown',
      mobile: uaData?.mobile ?? 'unknown',
      installedPwa: mediaQuery('(display-mode: standalone)'),
    },
    hardware: { cpuCores, memoryGb },
    graphics,
    display: {
      width: positiveNumber(display?.width),
      height: positiveNumber(display?.height),
      pixelRatio: positiveNumber(typeof devicePixelRatio === 'number' ? devicePixelRatio : undefined),
      colorDepth: positiveNumber(display?.colorDepth),
      hdr: mediaQuery('(dynamic-range: high)'),
      multipleDisplays: typeof isExtended === 'boolean' ? isExtended : 'unknown',
      touch: (nav?.maxTouchPoints ?? 0) > 0,
    },
    devices: await readDevices(),
    tier: computeTier(cpuCores, memoryGb, graphics.webgpu, graphics.webgl2),
  };
});

/** Calls back when a gamepad or media device is added or removed. Returns a function that stops watching. */
export function watchDevices(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;

  window.addEventListener('gamepadconnected', onChange);
  window.addEventListener('gamepaddisconnected', onChange);
  media?.addEventListener?.('devicechange', onChange);

  return () => {
    window.removeEventListener('gamepadconnected', onChange);
    window.removeEventListener('gamepaddisconnected', onChange);
    media?.removeEventListener?.('devicechange', onChange);
  };
}
