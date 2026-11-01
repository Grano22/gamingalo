import { GamingaloError } from '@gamingalo/errors';
import { snapshotOwn } from '../config';
import { clone, freeze, isArray, objectKeys, parseJson, SafeMap, stringifyJson } from '../primordials';
import type { KeyValueStore } from './settings';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PreferenceDefinition =
  | { type: 'number'; default: number; min?: number; max?: number }
  | { type: 'boolean'; default: boolean }
  | { type: 'string'; default: string; options?: readonly string[] }
  | { type: 'json'; default: JsonValue };

export interface PreferenceChange {
  readonly key: string;
  /** The current value, which is the default after a reset. `undefined` if there is none. */
  readonly value: JsonValue | undefined;
}

/** Custom game settings, defined by the game and chosen by the player. */
export interface Preferences {
  /** `false` when storage is unavailable or the last write failed, so recent values may last only for this session. */
  readonly persistent: boolean;
  /** Declares preferences, their types and defaults. Throws `INVALID_ARGUMENT` for a bad definition. */
  define(definitions: Record<string, PreferenceDefinition>): void;
  get<T extends JsonValue>(key: string, fallback: T): T;
  get(key: string): JsonValue | undefined;
  /** Throws `INVALID_ARGUMENT` for an empty key, a non-JSON value or one that doesn't fit its definition. */
  set(key: string, value: JsonValue): void;
  /** Returns one preference to its default, or all of them when no key is given. */
  reset(key?: string): void;
  /** Every stored value and defined default. */
  all(): Record<string, JsonValue>;
}

function invalid(message: string): GamingaloError {
  return new GamingaloError('INVALID_ARGUMENT', message);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (isArray(value)) return value.every(isJsonValue);
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

function fitsDefinition(definition: PreferenceDefinition, value: unknown): boolean {
  switch (definition.type) {
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (definition.min === undefined || value >= definition.min) &&
        (definition.max === undefined || value <= definition.max)
      );
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string' && (definition.options === undefined || definition.options.includes(value));
    case 'json':
      return isValidJson(value);
  }
}

function parseDefinition(key: string, input: unknown): PreferenceDefinition {
  const own = snapshotOwn(input);
  if (!own) throw invalid(`The definition of "${key}" must be an object.`);
  const { type, min, max, options } = own;
  if (type !== 'number' && type !== 'boolean' && type !== 'string' && type !== 'json') {
    throw invalid(`The definition of "${key}" has an unknown type.`);
  }
  if (min !== undefined && typeof min !== 'number') throw invalid(`The minimum of "${key}" must be a number.`);
  if (max !== undefined && typeof max !== 'number') throw invalid(`The maximum of "${key}" must be a number.`);
  if (options !== undefined && (!isArray(options) || !options.every((option) => typeof option === 'string'))) {
    throw invalid(`The options of "${key}" must be a list of strings.`);
  }
  const definition = freeze({
    ...own,
    ...(isArray(options) ? { options: freeze([...(options as string[])]) } : {}),
  }) as unknown as PreferenceDefinition;
  if (!fitsDefinition(definition, own['default'])) throw invalid(`The default of "${key}" doesn't fit its definition.`);
  return definition;
}

export interface PreferencesOptions {
  storageKey: string;
  store: KeyValueStore | undefined;
  onChange: (change: PreferenceChange) => void;
}

export function createPreferences({ storageKey, store, onChange }: PreferencesOptions): Preferences {
  const values = new SafeMap<string, JsonValue>();
  const definitions = new SafeMap<string, PreferenceDefinition>();
  let persistent = !!store;

  try {
    const stored: unknown = parseJson(store?.getItem(storageKey) ?? 'null');
    if (typeof stored === 'object' && stored !== null && !isArray(stored)) {
      const names = objectKeys(stored);
      for (let index = 0; index < names.length; index++) {
        const name = names[index] as string;
        const value: unknown = (stored as Record<string, unknown>)[name];
        if (isValidJson(value)) values.set(name, value);
      }
    }
  } catch {
    // Corrupted or unreadable values are treated as empty, so a bad value can't stop a game from starting.
  }

  const save = () => {
    if (!store) return;
    try {
      store.setItem(storageKey, stringifyJson(Object.fromEntries(values)));
      persistent = true;
    } catch {
      persistent = false;
    }
  };

  /** A stored value that no longer fits its definition is ignored, and stays stored until replaced. */
  const current = (key: string): JsonValue | undefined => {
    const definition = definitions.get(key);
    const value = values.get(key);
    if (value !== undefined && (!definition || fitsDefinition(definition, value))) return value;
    return definition?.default;
  };

  const notify = (key: string) => {
    const value = current(key);
    onChange(freeze({ key, value: value === undefined ? undefined : clone(value) }));
  };

  return {
    get persistent() {
      return persistent;
    },
    define(input) {
      const own = snapshotOwn(input);
      if (!own) throw invalid('define() needs an object.');
      const parsed = new SafeMap<string, PreferenceDefinition>();
      // Validated first, so that one bad definition changes nothing.
      for (const key of objectKeys(own)) parsed.set(key, parseDefinition(key, own[key]));
      parsed.forEach((definition, key) => definitions.set(key, definition));
    },
    get(key: string, fallback?: JsonValue) {
      const value = current(key);
      return (value === undefined ? fallback : clone(value)) as never;
    },
    set(key, value) {
      if (typeof key !== 'string' || key === '') throw invalid('A preference key must be a non-empty string.');
      if (!isValidJson(value)) throw invalid(`The value of "${key}" must be JSON.`);
      const definition = definitions.get(key);
      if (definition && !fitsDefinition(definition, value)) throw invalid(`The value of "${key}" doesn't fit its definition.`);
      values.set(key, clone(value));
      save();
      notify(key);
    },
    reset(key) {
      if (key !== undefined) {
        if (values.delete(key)) {
          save();
          notify(key);
        }
        return;
      }
      const names: string[] = [];
      values.forEach((_value, name) => names.push(name));
      values.clear();
      save();
      for (const name of names) notify(name);
    },
    all() {
      const merged = new SafeMap<string, JsonValue>();
      definitions.forEach((definition, key) => merged.set(key, definition.default));
      values.forEach((_value, key) => {
        const value = current(key);
        if (value !== undefined) merged.set(key, value);
      });
      return clone(Object.fromEntries(merged));
    },
  };
}
