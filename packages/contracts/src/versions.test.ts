import { describe, expect, it } from 'vitest';
import { createMigrationChain, FORMAT_VERSIONS, MigrationError, readFormatVersion } from './versions';
import { gameConfigMigrations, parseGameConfig } from './index';

const chain = createMigrationChain('test', 3, {
  1: { up: (v) => ({ ...(v as object), b: 2 }), down: (v) => ({ a: (v as { a: number }).a }) },
  2: { up: (v) => ({ ...(v as object), c: 3 }) },
});

describe('migration chains', () => {
  it('steps up through every version', () => {
    expect(chain.migrate({ a: 1 }, 1)).toEqual({ a: 1, b: 2, c: 3 });
    expect(chain.migrate({ a: 1 }, 1, 2)).toEqual({ a: 1, b: 2 });
    expect(chain.migrate({ a: 1, b: 2, c: 3 }, 3)).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('steps down where a step allows it, and refuses where it does not', () => {
    expect(chain.migrate({ a: 1, b: 2 }, 2, 1)).toEqual({ a: 1 });
    expect(() => chain.migrate({ a: 1, b: 2, c: 3 }, 3, 1)).toThrow(/can't be converted back to 2/);
  });

  it('is deterministic and never changes its input', () => {
    const input = { a: 1 };
    const first = chain.migrate(input, 1);
    expect(chain.migrate(input, 1)).toEqual(first);
    expect(input).toEqual({ a: 1 });
  });

  it('refuses versions it does not know', () => {
    expect(() => chain.migrate({}, 4)).toThrow(MigrationError);
    expect(() => chain.migrate({}, 4)).toThrow(/newer than this tool supports/);
    expect(() => chain.migrate({}, 0)).toThrow(/positive whole number/);
    expect(() => createMigrationChain('gap', 3, { 2: { up: (v) => v } }).migrate({}, 1)).toThrow(/no migration from version 1/);
  });

  it('reports the versions it supports', () => {
    expect(chain.supported()).toEqual([1, 2, 3]);
    expect(createMigrationChain('new', 1).supported()).toEqual([1]);
    expect(createMigrationChain('gap', 3, { 2: { up: (v) => v } }).supported()).toEqual([2, 3]);
  });

  it('ignores steps from a polluted prototype', () => {
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['1'] = { up: () => 'evil' };
    try {
      expect(() => createMigrationChain('x', 2).migrate({}, 1)).toThrow(/no migration/);
    } finally {
      delete prototype['1'];
    }
  });
});

describe('format versions', () => {
  it('reads a version, treating a missing one as the first release', () => {
    expect(readFormatVersion({ schemaVersion: 2 }, 'schemaVersion')).toBe(2);
    expect(readFormatVersion({}, 'schemaVersion')).toBe(1);
    expect(() => readFormatVersion({ schemaVersion: '2' }, 'schemaVersion')).toThrow(/positive whole number/);
  });

  it('has a chain for gamingalo.json at the current version', () => {
    expect(gameConfigMigrations.current).toBe(FORMAT_VERSIONS.gameConfig);
    expect(parseGameConfig({ id: 'my-game', title: 'x', version: '1.0.0' }).schemaVersion).toBe(1);
    expect(() => parseGameConfig({ schemaVersion: 99, id: 'my-game', title: 'x', version: '1.0.0' })).toThrow(/newer/);
  });
});
