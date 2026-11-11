import { describe, expect, it } from 'vitest';
import { canonicalManifest, contentTypeFor, filePathSchema, gameConfigSchema, gameIdSchema, manifestSchema } from './index';

const hash = 'a'.repeat(64);

describe('game IDs', () => {
  it.each(['abc', 'my-game', 'a1-b2-c3', 'x'.repeat(40)])('accepts %s', (id) => {
    expect(gameIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(['ab', 'My-Game', '-abc', 'abc-', 'a--b', 'preview--x', 'x'.repeat(41), 'a_b', 'a.b'])('rejects %s', (id) => {
    expect(gameIdSchema.safeParse(id).success).toBe(false);
  });
});

describe('file paths', () => {
  it.each(['index.html', 'assets/app.js', 'a/b/c/model.glb', 'audio/theme-1.ogg', 'game.wasm'])('accepts %s', (path) => {
    expect(filePathSchema.safeParse(path).success).toBe(true);
  });

  it.each([
    ['a parent directory', '../secret.js'],
    ['a nested parent directory', 'a/../../b.js'],
    ['an absolute path', '/index.html'],
    ['a hidden file', '.env.json'],
    ['a backslash', 'a\\b.js'],
    ['an empty segment', 'a//b.js'],
    ['a trailing slash', 'assets/'],
    ['an executable', 'setup.exe'],
    ['a shell script', 'run.sh'],
    ['no extension', 'README'],
    ['a dot segment', './index.html'],
  ])('rejects %s', (_name, path) => {
    expect(filePathSchema.safeParse(path).success).toBe(false);
  });

  it('maps extensions to content types, ignoring case', () => {
    expect(contentTypeFor('a/B.PNG')).toBe('image/png');
    expect(contentTypeFor('x.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('x.php')).toBeUndefined();
    expect(contentTypeFor('x.constructor')).toBeUndefined();
  });
});

describe('manifest', () => {
  const manifest = {
    gameId: 'my-game',
    version: '1.0.0',
    entry: 'index.html',
    files: [
      { path: 'index.html', size: 10, sha256: hash },
      { path: 'a.js', size: 5, sha256: hash },
    ],
  };

  it('needs the entry file and unique paths', () => {
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifestSchema.safeParse({ ...manifest, entry: 'missing.html' }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...manifest, files: [...manifest.files, manifest.files[0]] }).success).toBe(false);
  });

  it('has the same canonical form regardless of file order', () => {
    const reversed = { ...manifest, files: [...manifest.files].reverse() };
    expect(canonicalManifest(manifestSchema.parse(reversed))).toBe(canonicalManifest(manifestSchema.parse(manifest)));
    expect(canonicalManifest(manifestSchema.parse(manifest))).toContain('"files":[{"path":"a.js"');
  });
});

describe('gamingalo.json', () => {
  it('fills in defaults', () => {
    expect(gameConfigSchema.parse({ id: 'my-game', title: 'My game', version: '1.0.0' })).toMatchObject({
      dir: 'dist',
      entry: 'index.html',
    });
  });

  it('rejects unknown fields and bad versions', () => {
    expect(gameConfigSchema.safeParse({ id: 'my-game', title: 'x', version: '1.0' }).success).toBe(false);
    expect(gameConfigSchema.safeParse({ id: 'my-game', title: 'x', version: '1.0.0', extra: 1 }).success).toBe(false);
  });
});
