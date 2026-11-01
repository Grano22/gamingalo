import { GamingaloError } from '@gamingalo/errors';
import { freeze, hasOwn, parseJson, SafeMap, stringifyJson } from '../primordials';
import type { CapabilityTier } from './environment';

const QUALITY_PRESETS = freeze({
  low: freeze({
    resolutionScale: 0.75,
    textureQuality: 'low',
    shadowQuality: 'off',
    antialiasing: false,
    targetFps: 30,
    powerPreference: 'low-power',
  } as const),
  medium: freeze({
    resolutionScale: 1,
    textureQuality: 'medium',
    shadowQuality: 'low',
    antialiasing: true,
    targetFps: 60,
    powerPreference: 'high-performance',
  } as const),
  high: freeze({
    resolutionScale: 1,
    textureQuality: 'high',
    shadowQuality: 'high',
    antialiasing: true,
    targetFps: 60,
    powerPreference: 'high-performance',
  } as const),
});

export type QualityLevel = keyof typeof QUALITY_PRESETS;
export type GraphicsPreset = QualityLevel | 'auto';

/** Recommended values. The SDK never changes the renderer: the game decides how to apply them. */
export type GraphicsSettings = (typeof QUALITY_PRESETS)[QualityLevel] & {
  preset: GraphicsPreset;
  quality: QualityLevel;
};

/** Developer-level controls. Custom game settings belong in `sdk.preferences`. */
export interface Settings {
  /** `false` when storage is unavailable or the last write failed, so the preset may last only for this session. */
  readonly persistent: boolean;
  getGraphicsPreset(): GraphicsPreset;
  /** Saves the preset and returns its recommended values. */
  setGraphicsPreset(preset: GraphicsPreset): Promise<GraphicsSettings>;
  getGraphics(): Promise<GraphicsSettings>;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createMemoryStore(): KeyValueStore {
  const items = new SafeMap<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

/** Returns `undefined` when the browser blocks storage. Even reading the property can throw. */
export function getBrowserStore(): KeyValueStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function isGraphicsPreset(value: unknown): value is GraphicsPreset {
  return value === 'auto' || (typeof value === 'string' && hasOwn(QUALITY_PRESETS, value));
}

/** The result is frozen, so one event handler can't change what the next one receives. */
export function resolveGraphics(preset: GraphicsPreset, tier: CapabilityTier): GraphicsSettings {
  const quality: QualityLevel = preset !== 'auto' ? preset : tier === 'unknown' ? 'medium' : tier;
  return freeze({ ...QUALITY_PRESETS[quality], preset, quality });
}

freeze(resolveGraphics);

export interface SettingsOptions {
  gameId: string;
  store: KeyValueStore | undefined;
  readTier: () => Promise<CapabilityTier>;
  onGraphicsChange: (graphics: GraphicsSettings) => void;
}

export function createSettings(options: SettingsOptions): Settings {
  const { store, readTier, onGraphicsChange } = options;
  const storageKey = `gamingalo:${options.gameId}:settings`;
  let graphicsPreset: GraphicsPreset = 'auto';
  let persistent = !!store;

  try {
    const stored: unknown = parseJson(store?.getItem(storageKey) ?? 'null');
    if (typeof stored === 'object' && stored !== null && hasOwn(stored, 'graphicsPreset')) {
      // Own properties only, so a polluted prototype can't supply settings.
      const preset = (stored as Record<string, unknown>)['graphicsPreset'];
      if (isGraphicsPreset(preset)) graphicsPreset = preset;
    }
  } catch {
    // Corrupted or unreadable settings are treated as empty, so a bad value can't stop a game from starting.
  }

  const save = () => {
    if (!store) return;
    try {
      store.setItem(storageKey, stringifyJson({ graphicsPreset }));
      persistent = true;
    } catch {
      persistent = false;
    }
  };

  return {
    get persistent() {
      return persistent;
    },
    getGraphicsPreset() {
      return graphicsPreset;
    },
    async setGraphicsPreset(preset) {
      if (!isGraphicsPreset(preset)) {
        throw new GamingaloError('INVALID_ARGUMENT', 'The graphics preset must be auto, low, medium or high.');
      }
      graphicsPreset = preset;
      save();
      const graphics = resolveGraphics(preset, await readTier());
      onGraphicsChange(graphics);
      return graphics;
    },
    async getGraphics() {
      return resolveGraphics(graphicsPreset, await readTier());
    },
  };
}
