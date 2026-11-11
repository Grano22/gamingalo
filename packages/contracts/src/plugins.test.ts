import { describe, expect, it } from 'vitest';
import { pluginManifestSchema } from './index';

describe('plugin manifest', () => {
  it('defaults the export name', () => {
    expect(pluginManifestSchema.parse({ formatVersion: 1, sdk: '>=0.14.0' })).toEqual({
      formatVersion: 1,
      sdk: '>=0.14.0',
      export: 'gamingaloPlugin',
    });
  });

  it.each([
    ['a missing SDK range', { formatVersion: 1 }],
    ['another format version', { formatVersion: 2, sdk: '*' }],
    ['an export that is not an identifier', { formatVersion: 1, sdk: '*', export: 'a-b' }],
    ['unknown fields', { formatVersion: 1, sdk: '*', entry: './x.js' }],
  ])('rejects %s', (_name, manifest) => {
    expect(pluginManifestSchema.safeParse(manifest).success).toBe(false);
  });
});
