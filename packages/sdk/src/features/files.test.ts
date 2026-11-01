import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { createMemoryFiles, createOpfsFiles, getBrowserFiles } from './files';

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
});

function rootThatFails(name: string): () => Promise<FileSystemDirectoryHandle> {
  return () => Promise.reject(new DOMException('x', name));
}

describe('memory files', () => {
  it('writes each data type, reads, lists and deletes', async () => {
    const files = createMemoryFiles(() => 7);
    await files.write('song.mp3', new Blob(['abc']));
    await files.write('text', 'hello');
    await files.write('stream', new Blob(['streamed']).stream() as ReadableStream<Uint8Array<ArrayBuffer>>);

    expect(await (await files.read('song.mp3'))?.text()).toBe('abc');
    expect(await (await files.read('text'))?.text()).toBe('hello');
    expect(await (await files.read('stream'))?.text()).toBe('streamed');
    expect(await files.list()).toContainEqual({ name: 'song.mp3', size: 3, lastModified: 7 });

    expect(await files.delete('song.mp3')).toBe(true);
    expect(await files.delete('song.mp3')).toBe(false);
    expect(await files.read('song.mp3')).toBeUndefined();
  });

  it('rejects an empty name', async () => {
    await expect(createMemoryFiles().write('', 'x')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

describe('OPFS errors', () => {
  it('reports a missing file as undefined or false', async () => {
    const files = createOpfsFiles('x', rootThatFails('NotFoundError'));
    expect(await files.read('a')).toBeUndefined();
    expect(await files.delete('a')).toBe(false);
  });

  it('reports whether storage really works', async () => {
    expect(await createOpfsFiles('x', rootThatFails('UnknownError')).available()).toBe(false);
    expect(await createMemoryFiles().available()).toBe(true);
  });

  it('maps a full disk to STORAGE_QUOTA_EXCEEDED', async () => {
    const files = createOpfsFiles('x', rootThatFails('QuotaExceededError'));
    await expect(files.write('a', 'x')).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' });
  });

  it('maps other failures to STORAGE_UNAVAILABLE', async () => {
    const files = createOpfsFiles('x', rootThatFails('SecurityError'));
    await expect(files.list()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('aborts a failed write, so the previous file stays intact', async () => {
    const abort = vi.fn(async () => {});
    const writable = { write: () => Promise.reject(new DOMException('x', 'QuotaExceededError')), abort };
    const root = {
      getDirectoryHandle: async () => ({
        getFileHandle: async () => ({ createWritable: async () => writable }),
      }),
    } as unknown as FileSystemDirectoryHandle;

    const files = createOpfsFiles('x', async () => root);

    await expect(files.write('a', 'data')).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' });
    expect(abort).toHaveBeenCalledTimes(1);
  });
});

describe('availability', () => {
  it('is unavailable without OPFS', () => {
    vi.stubGlobal('navigator', {});
    expect(getBrowserFiles('x')).toBeUndefined();
  });

  it('is unavailable in production without OPFS, and throws FEATURE_UNAVAILABLE', async () => {
    vi.stubGlobal('navigator', {});
    const sdk = await startSdk();
    expect(sdk.features.has('files')).toBe(false);
    expect(() => sdk.files).toThrowError(/OPFS/);
  });

  it('works in mock mode by default, and can be excluded', async () => {
    const sdk = await createMockSdk();
    expect(sdk.features.has('files')).toBe(true);
    await sdk.files.write('a', 'x');
    expect(await (await sdk.files.read('a'))?.text()).toBe('x');

    const without = await createMockSdk({ features: [] });
    expect(without.features.has('files')).toBe(false);
    expect(() => without.files).toThrow();
  });
});
