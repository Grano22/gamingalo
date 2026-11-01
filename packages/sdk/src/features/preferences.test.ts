import { describe, expect, it, vi } from 'vitest';
import { createMockSdk } from '../testing';
import { createPreferences, type Preferences } from './preferences';
import { createMemoryStore, type KeyValueStore } from './settings';

function create(store: KeyValueStore | undefined = createMemoryStore(), onChange = vi.fn()): Preferences {
  return createPreferences({ storageKey: 'k', store, onChange });
}

describe('values', () => {
  it('stores, reads and resets values', () => {
    const preferences = create();
    preferences.set('volume', 0.5);
    preferences.set('keys', { jump: 'Space' });

    expect(preferences.get('volume')).toBe(0.5);
    expect(preferences.get('missing')).toBeUndefined();
    expect(preferences.get('missing', 1)).toBe(1);
    expect(preferences.all()).toEqual({ volume: 0.5, keys: { jump: 'Space' } });

    preferences.reset('volume');
    expect(preferences.get('volume', 1)).toBe(1);
    preferences.reset();
    expect(preferences.all()).toEqual({});
  });

  it('survives being created again from the same store, and stays per key', () => {
    const store = createMemoryStore();
    create(store).set('volume', 0.5);
    expect(create(store).get('volume')).toBe(0.5);
    expect(createPreferences({ storageKey: 'other', store, onChange: () => {} }).get('volume')).toBeUndefined();
  });

  it('does not let callers change stored values through a reference', () => {
    const preferences = create();
    const input = { level: 1 };
    preferences.set('progress', input);
    input.level = 2;
    (preferences.get('progress') as { level: number }).level = 3;
    expect(preferences.get('progress')).toEqual({ level: 1 });
  });

  it('handles a key that could pollute prototypes', () => {
    const store = createMemoryStore();
    create(store).set('__proto__', 'x');
    expect(create(store).get('__proto__')).toBe('x');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['a function', () => {}],
    ['NaN', Number.NaN],
    ['a date', new Date()],
    ['a nested map', { value: new Map() }],
  ])('rejects %s', (_name, value) => {
    expect(() => create().set('key', value as never)).toThrow(/must be JSON/);
  });

  it('rejects a circular value and an empty key', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => create().set('key', circular as never)).toThrow(/must be JSON/);
    expect(() => create().set('', 1)).toThrow(/non-empty/);
  });
});

describe('definitions', () => {
  const definitions = {
    volume: { type: 'number', default: 0.8, min: 0, max: 1 },
    subtitles: { type: 'boolean', default: true },
    difficulty: { type: 'string', default: 'normal', options: ['easy', 'normal', 'hard'] },
    layout: { type: 'json', default: { jump: 'Space' } },
  } as const;

  it('gives defaults, and includes them in all()', () => {
    const preferences = create();
    preferences.define(definitions);
    expect(preferences.get('volume')).toBe(0.8);
    expect(preferences.all()).toEqual({ volume: 0.8, subtitles: true, difficulty: 'normal', layout: { jump: 'Space' } });
  });

  it('prefers a stored value over the default, until reset', () => {
    const preferences = create();
    preferences.define(definitions);
    preferences.set('volume', 0.2);
    expect(preferences.get('volume')).toBe(0.2);
    preferences.reset('volume');
    expect(preferences.get('volume')).toBe(0.8);
  });

  it.each([
    ['volume', 2],
    ['volume', 'loud'],
    ['subtitles', 'yes'],
    ['difficulty', 'impossible'],
  ])('rejects %s = %s', (key, value) => {
    const preferences = create();
    preferences.define(definitions);
    expect(() => preferences.set(key, value)).toThrow(/doesn't fit/);
  });

  it('ignores a stored value that no longer fits, without deleting it', () => {
    const store = createMemoryStore();
    create(store).set('volume', 5);
    const preferences = create(store);
    preferences.define(definitions);
    expect(preferences.get('volume')).toBe(0.8);
    expect(preferences.all()['volume']).toBe(0.8);
  });

  it.each([
    ['not an object', 5],
    ['an unknown type', { type: 'date', default: 1 }],
    ['a default of the wrong type', { type: 'number', default: 'x' }],
    ['a default out of range', { type: 'number', default: 5, max: 1 }],
    ['a default not in its options', { type: 'string', default: 'x', options: ['y'] }],
    ['bad options', { type: 'string', default: 'x', options: [1] }],
    ['a bad minimum', { type: 'number', default: 1, min: 'x' }],
  ])('rejects %s, and changes nothing', (_name, definition) => {
    const preferences = create();
    expect(() =>
      preferences.define({ good: { type: 'boolean', default: true }, bad: definition as never }),
    ).toThrow();
    expect(preferences.get('good')).toBeUndefined();
  });

  it('copies option lists, so they can not change later', () => {
    const options = ['a'];
    const preferences = create();
    preferences.define({ mode: { type: 'string', default: 'a', options } });
    options.push('b');
    expect(() => preferences.set('mode', 'b')).toThrow(/doesn't fit/);
  });
});

describe('storage problems', () => {
  it('treats corrupted data or the wrong shape as empty', () => {
    for (const stored of ['{not json', '[1]', '5']) {
      const store = createMemoryStore();
      store.setItem('k', stored);
      expect(create(store).all()).toEqual({});
    }
  });

  it('keeps values in memory when a write fails, and reports it', () => {
    const preferences = create({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    expect(preferences.persistent).toBe(true);
    preferences.set('volume', 0.5);
    expect(preferences.get('volume')).toBe(0.5);
    expect(preferences.persistent).toBe(false);
  });

  it('works when reading storage throws, and without a store', () => {
    const blocked = create({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(blocked.all()).toEqual({});

    const preferences = createPreferences({ storageKey: 'k', store: undefined, onChange: () => {} });
    preferences.set('volume', 1);
    expect(preferences.persistent).toBe(false);
    expect(preferences.get('volume')).toBe(1);
  });
});

describe('sdk.preferences', () => {
  it('emits frozen changes, including the default after a reset', async () => {
    const sdk = await createMockSdk();
    const handler = vi.fn();
    sdk.on('preferences', handler);
    sdk.preferences.define({ volume: { type: 'number', default: 0.8 } });

    sdk.preferences.set('volume', 0.5);
    sdk.preferences.reset('volume');
    sdk.preferences.reset('volume');

    expect(handler.mock.calls).toEqual([[{ key: 'volume', value: 0.5 }], [{ key: 'volume', value: 0.8 }]]);
    expect(Object.isFrozen(handler.mock.calls[0]?.[0])).toBe(true);
  });

  it('does not touch browser storage in mock mode', async () => {
    const sdk = await createMockSdk();
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    sdk.preferences.set('volume', 1);
    expect(spy).not.toHaveBeenCalled();
    expect(sdk.preferences.get('volume')).toBe(1);
  });
});
