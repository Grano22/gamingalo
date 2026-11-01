import { GamingaloError } from '@gamingalo/errors';
import { freeze, hasOwn, matches, objectKeys, SafeMap } from '../primordials';
import type { KeyValueStore } from './settings';

type Unknown = 'unknown';
export type TextDirection = 'ltr' | 'rtl';
export type KeyboardLayoutName = 'qwerty' | 'qwertz' | 'azerty' | 'dvorak' | 'colemak' | 'other' | Unknown;

export interface KeyboardInfo {
  readonly layout: KeyboardLayoutName;
  /** Physical key codes mapped to labels, such as `KeyZ` to `y`. Empty where the browser doesn't expose them. */
  readonly keys: Readonly<Record<string, string>>;
}

export interface LocaleDetection {
  /** The player's preferred language, or `unknown`. */
  readonly language: string | Unknown;
  readonly languages: readonly string[];
  /** From the language settings, not the player's position. */
  readonly region: string | Unknown;
  readonly timeZone: string | Unknown;
  readonly direction: TextDirection;
  readonly keyboard: KeyboardInfo;
}

export type GeolocationResult =
  | {
      readonly status: 'granted';
      readonly latitude: number;
      readonly longitude: number;
      readonly accuracyMeters: number;
    }
  | { readonly status: 'denied' | 'unavailable' | 'timeout' };

export interface GeolocationOptions {
  /** Between 1 and 120000. Defaults to 10000. */
  timeoutMs?: number;
  /** Uses more power and takes longer. Defaults to `false`. */
  highAccuracy?: boolean;
}

export type MessageParams = Readonly<Record<string, string | number>>;

/** Messages, formatting, and detection of a player's language, region and keyboard. */
export interface Localization {
  /** The chosen locale, or the player's preferred language when none was chosen. */
  locale(): string;
  /** Saves the choice. Pass `null` to follow the browser again. Throws `INVALID_ARGUMENT` for an invalid tag. */
  setLocale(locale: string | null): void;
  /** The locale used when a message is missing. Defaults to `en`. */
  setFallbackLocale(locale: string): void;
  /** Adds plain text messages, keeping existing ones with other keys. */
  addMessages(locale: string, messages: Readonly<Record<string, string>>): void;
  availableLocales(): string[];
  /** Returns the message, or its key if it's missing. */
  t(key: string, params?: MessageParams): string;
  direction(): TextDirection;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  /** Shows no prompts. */
  detect(): Promise<LocaleDetection>;
  /** May show a permission prompt, so call it in response to a player's action. Never rejects for a refusal. */
  requestGeolocation(options?: GeolocationOptions): Promise<GeolocationResult>;
}

/** Where detected values come from, so that tests can supply their own. */
export interface LocaleSource {
  languages(): readonly string[];
  timeZone(): string | Unknown;
  keyboard(): Promise<KeyboardInfo>;
  geolocation(options: { timeoutMs: number; highAccuracy: boolean }): Promise<GeolocationResult>;
}

const RTL_LANGUAGES = freeze({
  __proto__: null,
  ar: true,
  arc: true,
  ckb: true,
  dv: true,
  fa: true,
  he: true,
  ks: true,
  ps: true,
  sd: true,
  ug: true,
  ur: true,
  yi: true,
});

const NO_KEYBOARD: KeyboardInfo = freeze({ layout: 'unknown', keys: freeze({}) });
const REGION_PATTERN = /^(?:[A-Z]{2}|\d{3})$/;

function invalid(message: string): GamingaloError {
  return new GamingaloError('INVALID_ARGUMENT', message);
}

function canonical(locale: unknown): string {
  if (typeof locale !== 'string' || locale === '') throw invalid('A locale must be a language tag such as "en-US".');
  try {
    return Intl.getCanonicalLocales(locale)[0] as string;
  } catch {
    throw invalid(`"${locale}" is not a valid language tag.`);
  }
}

function baseLanguage(locale: string): string {
  return locale.split('-')[0] as string;
}

export function regionOf(locale: string): string | Unknown {
  const parts = locale.split('-');
  for (let index = 1; index < parts.length; index++) {
    const part = parts[index] as string;
    if (part.length === 1) break;
    if (matches(REGION_PATTERN, part)) return part;
  }
  return 'unknown';
}

export function directionOf(locale: string): TextDirection {
  // A script subtag overrides the language's usual direction, as in `az-Arab` or `ur-Latn`.
  const parts = locale.split('-');
  if (parts.includes('Arab') || parts.includes('Hebr')) return 'rtl';
  if (parts.includes('Latn') || parts.includes('Cyrl')) return 'ltr';
  return hasOwn(RTL_LANGUAGES, baseLanguage(locale)) ? 'rtl' : 'ltr';
}

/** Identifies a layout from where the letters sit on physical keys. */
export function classifyKeyboard(keys: Readonly<Record<string, string>>): KeyboardLayoutName {
  const at = (code: string) => (hasOwn(keys, code) ? keys[code] : undefined);
  const [q, w, e, y] = [at('KeyQ'), at('KeyW'), at('KeyE'), at('KeyY')];
  if (q === undefined || w === undefined) return 'unknown';
  if (q === 'a' && w === 'z') return 'azerty';
  if (q === "'" && w === ',') return 'dvorak';
  if (q === 'q' && w === 'w' && e === 'f') return 'colemak';
  if (q === 'q' && w === 'w' && y === 'z') return 'qwertz';
  if (q === 'q' && w === 'w' && y === 'y') return 'qwerty';
  return 'other';
}

interface KeyboardApi {
  getLayoutMap(): Promise<{ forEach(callback: (value: string, key: string) => void): void }>;
}

export function createBrowserLocaleSource(): LocaleSource {
  return {
    languages() {
      if (typeof navigator === 'undefined') return [];
      if (navigator.languages?.length) return [...navigator.languages];
      return navigator.language ? [navigator.language] : [];
    },
    timeZone() {
      try {
        return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
      } catch {
        return 'unknown';
      }
    },
    async keyboard() {
      const api = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard;
      if (typeof api?.getLayoutMap !== 'function') return NO_KEYBOARD;
      try {
        const keys: Record<string, string> = {};
        (await api.getLayoutMap()).forEach((value, code) => {
          Object.defineProperty(keys, code, { __proto__: null, value, enumerable: true } as PropertyDescriptor);
        });
        return freeze({ layout: classifyKeyboard(keys), keys: freeze(keys) });
      } catch {
        // Blocked in some frames by permissions policy.
        return NO_KEYBOARD;
      }
    },
    geolocation({ timeoutMs, highAccuracy }) {
      return new Promise((resolve) => {
        const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
        if (!geolocation) {
          resolve(freeze({ status: 'unavailable' }));
          return;
        }
        try {
          geolocation.getCurrentPosition(
            ({ coords }) =>
              resolve(
                freeze({
                  status: 'granted',
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracyMeters: coords.accuracy,
                }),
              ),
            (error) => {
              const status = error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable';
              resolve(freeze({ status }));
            },
            { timeout: timeoutMs, enableHighAccuracy: highAccuracy, maximumAge: 0 },
          );
        } catch {
          resolve(freeze({ status: 'unavailable' }));
        }
      });
    },
  };
}

export interface LocalizationOptions {
  gameId: string;
  store: KeyValueStore | undefined;
  source: LocaleSource;
  onLocaleChange: (locale: string) => void;
}

export function createLocalization({ gameId, store, source, onLocaleChange }: LocalizationOptions): Localization {
  const storageKey = `gamingalo:${gameId}:locale`;
  const catalogs = new SafeMap<string, Map<string, string>>();
  let fallbackLocale = 'en';
  let chosen: string | null = null;

  try {
    const stored = store?.getItem(storageKey);
    if (stored) chosen = canonical(stored);
  } catch {
    // A corrupted or unreadable choice means following the browser.
  }

  const browserLanguages = (): string[] => {
    const valid: string[] = [];
    for (const language of source.languages()) {
      try {
        valid[valid.length] = canonical(language);
      } catch {
        // Skips a tag the browser reported but Intl rejects.
      }
    }
    return valid;
  };

  const currentLocale = () => chosen ?? browserLanguages()[0] ?? fallbackLocale;

  /** The locales to search, most specific first, with no repeats. */
  const lookupChain = (): string[] => {
    const preferred = chosen ? [chosen] : browserLanguages();
    const chain: string[] = [];
    const add = (locale: string) => {
      if (!chain.includes(locale)) chain[chain.length] = locale;
    };
    for (const locale of preferred) {
      add(locale);
      add(baseLanguage(locale));
    }
    add(fallbackLocale);
    add(baseLanguage(fallbackLocale));
    return chain;
  };

  const find = (key: string): { message: string; locale: string } | undefined => {
    for (const locale of lookupChain()) {
      const message = catalogs.get(locale)?.get(key);
      if (message !== undefined) return { message, locale };
    }
    return undefined;
  };

  const pluralCategory = (locale: string, count: number): string => {
    try {
      return new Intl.PluralRules(locale).select(count);
    } catch {
      return 'other';
    }
  };

  const fill = (message: string, params: MessageParams | undefined, locale: string): string =>
    message.replace(/\{([^{}]+)\}/g, (placeholder, name: string) => {
      if (!params || !hasOwn(params, name)) return placeholder;
      const value = params[name];
      if (typeof value === 'number') return new Intl.NumberFormat(locale).format(value);
      return typeof value === 'string' ? value : placeholder;
    });

  return {
    locale: currentLocale,

    setLocale(locale) {
      const next = locale === null ? null : canonical(locale);
      const before = currentLocale();
      chosen = next;
      try {
        if (next === null) store?.setItem(storageKey, '');
        else store?.setItem(storageKey, next);
      } catch {
        // The choice lasts for this session when storage is blocked or full.
      }
      if (currentLocale() !== before) onLocaleChange(currentLocale());
    },

    setFallbackLocale(locale) {
      fallbackLocale = canonical(locale);
    },

    addMessages(locale, messages) {
      const tag = canonical(locale);
      if (typeof messages !== 'object' || messages === null) throw invalid('addMessages() needs an object of messages.');
      const names = objectKeys(messages);
      for (const name of names) {
        if (typeof messages[name] !== 'string') throw invalid(`The message "${name}" must be text.`);
      }
      let catalog = catalogs.get(tag);
      if (!catalog) {
        catalog = new SafeMap<string, string>();
        catalogs.set(tag, catalog);
      }
      for (const name of names) catalog.set(name, messages[name] as string);
    },

    availableLocales() {
      const locales: string[] = [];
      catalogs.forEach((_catalog, locale) => {
        locales[locales.length] = locale;
      });
      return locales;
    },

    t(key, input) {
      const params = input !== undefined && input !== null && typeof input === 'object' ? input : undefined;
      const count = params && hasOwn(params, 'count') ? params['count'] : undefined;

      if (typeof count === 'number') {
        for (const locale of lookupChain()) {
          const catalog = catalogs.get(locale);
          const plural = catalog?.get(`${key}.${pluralCategory(locale, count)}`) ?? catalog?.get(`${key}.other`);
          if (plural !== undefined) return fill(plural, params, locale);
        }
      }
      const found = find(key);
      return found ? fill(found.message, params, found.locale) : key;
    },

    direction: () => directionOf(currentLocale()),

    formatNumber: (value, options) => new Intl.NumberFormat(currentLocale(), options).format(value),

    formatDate: (value, options) => new Intl.DateTimeFormat(currentLocale(), options).format(value),

    async detect() {
      const languages = browserLanguages();
      const language = languages[0] ?? 'unknown';
      return freeze({
        language,
        languages: freeze(languages),
        region: language === 'unknown' ? 'unknown' : regionOf(language),
        timeZone: source.timeZone(),
        direction: language === 'unknown' ? 'ltr' : directionOf(language),
        keyboard: await source.keyboard(),
      });
    },

    async requestGeolocation(options) {
      const own = options !== undefined && options !== null && typeof options === 'object' ? options : undefined;
      const timeoutMs = own && hasOwn(own, 'timeoutMs') ? own.timeoutMs : 10000;
      if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
        throw invalid('timeoutMs must be a whole number between 1 and 120000.');
      }
      const highAccuracy = !!own && hasOwn(own, 'highAccuracy') && own.highAccuracy === true;
      return source.geolocation({ timeoutMs, highAccuracy });
    },
  };
}
