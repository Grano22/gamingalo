import { GamingaloError } from '@gamingalo/errors';
import { clone, freeze, hasOwn, parseJson, SafeMap, stringifyJson } from '../primordials';
import type { CapabilityTier } from './environment';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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

export interface Settings {
  /** `false` when storage is unavailable or the last write failed, so recent values may last only for this session. */
  readonly persistent: boolean;
  get<T extends JsonValue>(key: string, fallback: T): T;
  get(key: string): JsonValue | undefined;
  /** Throws `INVALID_ARGUMENT` for an empty key or a value that isn't JSON. */
  set(key: string, value: JsonValue): void;
  remove(key: string): void;
  all(): Record<string, JsonValue>;
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

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJsonValue);
}

function isValidJson(value: unknown): value is JsonValue {
  try {
    return isJsonValue(value);
  } catch {
    // A circular structure overflows the stack.
    return false;
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
  const values = new SafeMap<string, JsonValue>();
  let graphicsPreset: GraphicsPreset = 'auto';
  let persistent = !!store;

  try {
    const stored: unknown = parseJson(store?.getItem(storageKey) ?? 'null');
    if (typeof stored === 'object' && stored !== null) {
      // Own properties only, so a polluted prototype can't supply settings.
      const fields = stored as Record<string, unknown>;
      const storedPreset = hasOwn(fields, 'graphicsPreset') ? fields['graphicsPreset'] : undefined;
      const storedValues = hasOwn(fields, 'values') ? fields['values'] : undefined;
      if (isGraphicsPreset(storedPreset)) graphicsPreset = storedPreset;
      if (typeof storedValues === 'object' && storedValues !== null) {
        for (const [key, value] of Object.entries(storedValues)) {
          if (isValidJson(value)) values.set(key, value);
        }
      }
    }
  } catch {
    // Corrupted or unreadable settings are treated as empty, so a bad value can't stop a game from starting.
  }

  const save = () => {
    if (!store) return;
    try {
      store.setItem(storageKey, stringifyJson({ values: Object.fromEntries(values), graphicsPreset }));
      persistent = true;
    } catch {
      persistent = false;
    }
  };

  const assertKey = (key: unknown) => {
    if (typeof key !== 'string' || key === '') {
      throw new GamingaloError('INVALID_ARGUMENT', 'A settings key must be a non-empty string.');
    }
  };

  return {
    get persistent() {
      return persistent;
    },
    get(key: string, fallback?: JsonValue) {
      const value = values.get(key);
      return (value === undefined ? fallback : clone(value)) as never;
    },
    set(key, value) {
      assertKey(key);
      if (!isValidJson(value)) {
        throw new GamingaloError('INVALID_ARGUMENT', `The value for setting "${key}" must be JSON.`);
      }
      values.set(key, clone(value));
      save();
    },
    remove(key) {
      if (values.delete(key)) save();
    },
    all() {
      return clone(Object.fromEntries(values));
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
