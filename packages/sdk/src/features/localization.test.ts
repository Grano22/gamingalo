import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import {
  classifyKeyboard,
  createBrowserLocaleSource,
  createLocalization,
  directionOf,
  regionOf,
  type Localization,
  type LocaleSource,
} from './localization';
import { createMemoryStore, type KeyValueStore } from './settings';

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
});

function source(languages: string[] = ['en-US'], extra: Partial<LocaleSource> = {}): LocaleSource {
  return {
    languages: () => languages,
    timeZone: () => 'Europe/Warsaw',
    keyboard: async () => ({ layout: 'qwerty', keys: {} }),
    geolocation: async () => ({ status: 'denied' }),
    ...extra,
  };
}

function create(languages?: string[], store: KeyValueStore = createMemoryStore(), onLocaleChange = vi.fn()): Localization {
  return createLocalization({ gameId: 'x', store, source: source(languages), onLocaleChange });
}

describe('messages', () => {
  it('fills parameters as plain text', () => {
    const l = create();
    l.addMessages('en', { greeting: 'Hello {name}', html: '{value}' });
    expect(l.t('greeting', { name: 'Ada' })).toBe('Hello Ada');
    expect(l.t('html', { value: '<b>x</b>' })).toBe('<b>x</b>');
  });

  it('leaves unknown placeholders, and returns the key for a missing message', () => {
    const l = create();
    l.addMessages('en', { greeting: 'Hello {name}' });
    expect(l.t('greeting')).toBe('Hello {name}');
    expect(l.t('greeting', { other: 'x' })).toBe('Hello {name}');
    expect(l.t('missing.key')).toBe('missing.key');
  });

  it('formats number parameters for the locale', () => {
    const l = create(['de']);
    l.addMessages('de', { score: 'Punkte: {points}' });
    expect(l.t('score', { points: 1234.5 })).toBe('Punkte: 1.234,5');
  });

  it('uses plural rules for the language', () => {
    const l = create(['pl']);
    l.addMessages('pl', {
      'coins.one': '{count} moneta',
      'coins.few': '{count} monety',
      'coins.many': '{count} monet',
      'coins.other': '{count} monety',
    });
    expect(l.t('coins', { count: 1 })).toBe('1 moneta');
    expect(l.t('coins', { count: 3 })).toBe('3 monety');
    expect(l.t('coins', { count: 5 })).toBe('5 monet');
  });

  it('falls back to .other, then the plain key, for plurals', () => {
    const l = create();
    l.addMessages('en', { 'a.other': '{count} things', b: 'plain {count}' });
    expect(l.t('a', { count: 1 })).toBe('1 things');
    expect(l.t('b', { count: 2 })).toBe('plain 2');
  });

  it('rejects invalid messages, and invalid locales', () => {
    const l = create();
    expect(() => l.addMessages('en', { a: 5 } as never)).toThrow(/must be text/);
    expect(() => l.addMessages('en', null as never)).toThrow(/needs an object/);
    expect(() => l.addMessages('not a tag!', {})).toThrow(/not a valid/);
  });
});

describe('fallback', () => {
  it('searches the chosen locale, its base, then the fallback', () => {
    const l = create(['pt-BR']);
    l.addMessages('pt-BR', { a: 'pt-BR a' });
    l.addMessages('pt', { a: 'pt a', b: 'pt b' });
    l.addMessages('en', { a: 'en a', b: 'en b', c: 'en c' });

    expect(l.t('a')).toBe('pt-BR a');
    expect(l.t('b')).toBe('pt b');
    expect(l.t('c')).toBe('en c');
  });

  it('tries each browser language in order', () => {
    const l = create(['fr-CA', 'de']);
    l.addMessages('de', { a: 'de a' });
    l.addMessages('en', { a: 'en a' });
    expect(l.t('a')).toBe('de a');
  });

  it('uses a custom fallback', () => {
    const l = create(['fr']);
    l.addMessages('es', { a: 'es a' });
    l.setFallbackLocale('es');
    expect(l.t('a')).toBe('es a');
  });

  it('skips invalid tags from the browser', () => {
    const l = create(['not a tag!', 'de']);
    expect(l.locale()).toBe('de');
  });
});

describe('locale', () => {
  it('follows the browser, and a saved choice wins until cleared', () => {
    const store = createMemoryStore();
    const onChange = vi.fn();
    const l = create(['en-US'], store, onChange);
    expect(l.locale()).toBe('en-US');

    l.setLocale('pl');
    expect(l.locale()).toBe('pl');
    expect(onChange).toHaveBeenCalledWith('pl');
    expect(create(['en-US'], store).locale()).toBe('pl');

    l.setLocale(null);
    expect(l.locale()).toBe('en-US');
    expect(create(['en-US'], store).locale()).toBe('en-US');
  });

  it('does not notify when nothing changes', () => {
    const onChange = vi.fn();
    const l = create(['en-US'], createMemoryStore(), onChange);
    l.setLocale('en-US');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('canonicalizes tags', () => {
    const l = create();
    l.setLocale('EN-us');
    expect(l.locale()).toBe('en-US');
  });

  it('rejects an invalid tag and keeps the current locale', () => {
    const l = create();
    expect(() => l.setLocale('not a tag!')).toThrow(/not a valid/);
    expect(l.locale()).toBe('en-US');
  });

  it('survives corrupted or blocked storage', () => {
    const store = createMemoryStore();
    store.setItem('gamingalo:x:locale', 'not a tag!');
    expect(create(['de'], store).locale()).toBe('de');

    const blocked = create(['de'], {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    blocked.setLocale('pl');
    expect(blocked.locale()).toBe('pl');
  });

  it('uses the fallback when the browser reports no languages', () => {
    expect(create([]).locale()).toBe('en');
  });
});

describe('direction and formatting', () => {
  it.each([
    ['ar', 'rtl'],
    ['he-IL', 'rtl'],
    ['fa', 'rtl'],
    ['ur-Latn', 'ltr'],
    ['az-Arab', 'rtl'],
    ['en', 'ltr'],
    ['pl-PL', 'ltr'],
  ] as const)('%s is %s', (locale, direction) => {
    expect(directionOf(locale)).toBe(direction);
  });

  it('follows the locale', () => {
    const l = create(['de']);
    expect(l.formatNumber(1234.5)).toBe('1.234,5');
    expect(l.direction()).toBe('ltr');
    l.setLocale('ar');
    expect(l.direction()).toBe('rtl');
    l.setLocale('en-US');
    expect(l.formatDate(new Date(Date.UTC(2026, 0, 15)), { timeZone: 'UTC' })).toBe('1/15/2026');
  });
});

describe('regionOf', () => {
  it.each([
    ['en-US', 'US'],
    ['zh-Hant-TW', 'TW'],
    ['es-419', '419'],
    ['en', 'unknown'],
    ['zh-Hant', 'unknown'],
    ['en-u-ca-gregory', 'unknown'],
  ])('%s is %s', (locale, region) => {
    expect(regionOf(locale)).toBe(region);
  });
});

describe('classifyKeyboard', () => {
  it.each([
    [{ KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyY: 'y' }, 'qwerty'],
    [{ KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyY: 'z' }, 'qwertz'],
    [{ KeyQ: 'a', KeyW: 'z', KeyE: 'e', KeyY: 'y' }, 'azerty'],
    [{ KeyQ: "'", KeyW: ',', KeyE: '.', KeyY: 'f' }, 'dvorak'],
    [{ KeyQ: 'q', KeyW: 'w', KeyE: 'f', KeyY: 'j' }, 'colemak'],
    [{ KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyY: 'н' }, 'other'],
    [{}, 'unknown'],
  ])('%j is %s', (keys, layout) => {
    expect(classifyKeyboard(keys as Record<string, string>)).toBe(layout);
  });
});

describe('detect', () => {
  it('reports language, region, time zone, direction and keyboard', async () => {
    const detected = await create(['pt-BR', 'en']).detect();
    expect(detected).toEqual({
      language: 'pt-BR',
      languages: ['pt-BR', 'en'],
      region: 'BR',
      timeZone: 'Europe/Warsaw',
      direction: 'ltr',
      keyboard: { layout: 'qwerty', keys: {} },
    });
    expect(Object.isFrozen(detected)).toBe(true);
  });

  it('reports unknown with no languages', async () => {
    const detected = await create([]).detect();
    expect(detected).toMatchObject({ language: 'unknown', region: 'unknown', languages: [] });
  });
});

describe('browser source', () => {
  it('is unknown where the keyboard API is missing or fails', async () => {
    vi.stubGlobal('navigator', {});
    expect(await createBrowserLocaleSource().keyboard()).toEqual({ layout: 'unknown', keys: {} });

    vi.stubGlobal('navigator', { keyboard: { getLayoutMap: () => Promise.reject(new Error('blocked')) } });
    expect(await createBrowserLocaleSource().keyboard()).toEqual({ layout: 'unknown', keys: {} });
  });

  it('reads the keyboard map', async () => {
    const map = new Map([
      ['KeyQ', 'a'],
      ['KeyW', 'z'],
    ]);
    vi.stubGlobal('navigator', { keyboard: { getLayoutMap: async () => map } });
    expect(await createBrowserLocaleSource().keyboard()).toEqual({
      layout: 'azerty',
      keys: { KeyQ: 'a', KeyW: 'z' },
    });
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps geolocation error %i to %s', async (code, status) => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) => fail({ code }) },
    });
    const result = await createBrowserLocaleSource().geolocation({ timeoutMs: 1, highAccuracy: false });
    expect(result).toEqual({ status });
  });

  it('reports unavailable without geolocation', async () => {
    vi.stubGlobal('navigator', {});
    const result = await createBrowserLocaleSource().geolocation({ timeoutMs: 1, highAccuracy: false });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('passes options, and returns only what games need', async () => {
    const getCurrentPosition = vi.fn((ok: (position: object) => void) =>
      ok({ coords: { latitude: 52.2, longitude: 21, accuracy: 30, altitude: 100 } }),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const result = await createBrowserLocaleSource().geolocation({ timeoutMs: 500, highAccuracy: true });

    expect(result).toEqual({ status: 'granted', latitude: 52.2, longitude: 21, accuracyMeters: 30 });
    expect(getCurrentPosition.mock.calls[0]).toEqual([
      expect.any(Function),
      expect.any(Function),
      { timeout: 500, enableHighAccuracy: true, maximumAge: 0 },
    ]);
  });
});

describe('requestGeolocation', () => {
  it('validates options, and uses defaults', async () => {
    const geolocation = vi.fn(async () => ({ status: 'denied' as const }));
    const l = createLocalization({ gameId: 'x', store: undefined, source: source(['en'], { geolocation }), onLocaleChange: () => {} });

    await l.requestGeolocation();
    expect(geolocation).toHaveBeenCalledWith({ timeoutMs: 10000, highAccuracy: false });
    await expect(l.requestGeolocation({ timeoutMs: 0 })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('is never called just by starting the SDK or detecting', async () => {
    const getCurrentPosition = vi.fn();
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    try {
      const sdk = await startSdk({ gameId: 'my-game', modules: ['localization'] });
      await sdk.localization.detect();
      expect(getCurrentPosition).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(navigator, 'geolocation', original);
      else delete (navigator as unknown as Record<string, unknown>)['geolocation'];
    }
  });
});

describe('polluted prototypes', () => {
  it('cannot supply parameters, plural counts or options', async () => {
    const geolocation = vi.fn(async () => ({ status: 'denied' as const }));
    const l = createLocalization({ gameId: 'x', store: undefined, source: source(['en'], { geolocation }), onLocaleChange: () => {} });
    l.addMessages('en', { greeting: 'Hello {name}', 'a.other': 'plural', a: 'plain' });
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['name'] = 'evil';
    prototype['count'] = 5;
    prototype['timeoutMs'] = 1;
    prototype['highAccuracy'] = true;
    let results: unknown[];
    try {
      await l.requestGeolocation({});
      results = [l.t('greeting', {}), l.t('a', {})];
    } finally {
      delete prototype['name'];
      delete prototype['count'];
      delete prototype['timeoutMs'];
      delete prototype['highAccuracy'];
    }
    expect(results).toEqual(['Hello {name}', 'plain']);
    expect(geolocation).toHaveBeenCalledWith({ timeoutMs: 10000, highAccuracy: false });
  });

  it('keeps a message key that could pollute prototypes contained', () => {
    const l = create();
    l.addMessages('en', JSON.parse('{"__proto__": "x", "constructor": "y"}') as Record<string, string>);
    expect(l.t('__proto__')).toBe('x');
    expect(l.t('constructor')).toBe('y');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('sdk.localization', () => {
  it('is unavailable unless listed in modules, in production and in mocks', async () => {
    const sdk = await startSdk();
    expect(sdk.features.has('localization')).toBe(false);
    expect(() => sdk.localization).toThrow(/modules/);
    const mocked = await createMockSdk();
    expect(() => mocked.localization).toThrow(/modules/);
  });

  it('rejects unknown modules', async () => {
    await expect(startSdk({ gameId: 'my-game', modules: ['nope' as never] })).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
    });
  });

  it('emits locale changes', async () => {
    const sdk = await startSdk({ gameId: 'my-game', modules: ['localization'] });
    const handler = vi.fn();
    sdk.on('locale', handler);
    sdk.localization.setLocale('ar');
    expect(handler).toHaveBeenCalledWith('ar');
    expect(Object.isFrozen(sdk.localization)).toBe(true);
    sdk.localization.setLocale(null);
  });

  it('has configurable languages, keyboard and geolocation in mock mode', async () => {
    const sdk = await createMockSdk({
      modules: ['localization'],
      localization: {
        languages: ['fr-CA'],
        keyboard: { layout: 'azerty', keys: { KeyQ: 'a' } },
        geolocation: { status: 'granted', latitude: 1, longitude: 2, accuracyMeters: 3 },
      },
    });

    const detected = await sdk.localization.detect();

    expect(detected).toMatchObject({ language: 'fr-CA', region: 'CA' });
    expect(detected.keyboard.layout).toBe('azerty');
    expect(await sdk.localization.requestGeolocation()).toMatchObject({ status: 'granted', latitude: 1 });
  });

  it('has fixed defaults in mock mode', async () => {
    const sdk = await createMockSdk({ modules: ['localization'] });
    expect(await sdk.localization.detect()).toMatchObject({ language: 'en-US', timeZone: 'UTC' });
    expect(await sdk.localization.requestGeolocation()).toEqual({ status: 'denied' });
  });
});
