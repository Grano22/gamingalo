import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Content-addressed storage: each file is kept once, under its SHA-256 hash. */
export interface BlobStore {
  has(sha256: string): Promise<boolean>;
  put(sha256: string, bytes: Uint8Array): Promise<void>;
  get(sha256: string): Promise<Uint8Array | undefined>;
}

const HASH = /^[0-9a-f]{64}$/;

function assertHash(sha256: string): void {
  // Keys become file names, so anything that isn't a hash is refused outright.
  if (!HASH.test(sha256)) throw new Error('Invalid blob key.');
}

export function createMemoryBlobStore(): BlobStore {
  const blobs = new Map<string, Uint8Array>();
  return {
    has: async (sha256) => blobs.has(sha256),
    put: async (sha256, bytes) => {
      assertHash(sha256);
      blobs.set(sha256, bytes);
    },
    get: async (sha256) => blobs.get(sha256),
  };
}

export function createFileBlobStore(root: string): BlobStore {
  const pathFor = (sha256: string) => {
    assertHash(sha256);
    return join(root, sha256.slice(0, 2), sha256);
  };
  return {
    has: async (sha256) => {
      try {
        await stat(pathFor(sha256));
        return true;
      } catch {
        return false;
      }
    },
    put: async (sha256, bytes) => {
      const target = pathFor(sha256);
      await mkdir(join(root, sha256.slice(0, 2)), { recursive: true });
      // Written to a temporary name and renamed, so a partial file is never visible under its hash.
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, target);
    },
    get: async (sha256) => {
      try {
        return new Uint8Array(await readFile(pathFor(sha256)));
      } catch {
        return undefined;
      }
    },
  };
}
