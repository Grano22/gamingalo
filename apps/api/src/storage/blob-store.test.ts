import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileBlobStore } from './blob-store';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'blobs-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const hash = 'ab'.repeat(32);

describe('file blob store', () => {
  it('stores and reads files by hash, leaving no temporary files', async () => {
    const store = createFileBlobStore(root);
    expect(await store.has(hash)).toBe(false);
    await store.put(hash, new TextEncoder().encode('hello'));
    expect(await store.has(hash)).toBe(true);
    expect(new TextDecoder().decode(await store.get(hash))).toBe('hello');
    expect(await readdir(join(root, 'ab'))).toEqual([hash]);
  });

  it('refuses keys that are not hashes, so they can not become paths', async () => {
    const store = createFileBlobStore(root);
    await expect(store.put('../../etc/passwd', new Uint8Array())).rejects.toThrow(/Invalid blob key/);
    expect(await store.has('../x')).toBe(false);
  });
});
