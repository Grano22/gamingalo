import { GamingaloError } from '@gamingalo/errors';
import { SafeMap } from '../primordials';
import { toStorageError } from './storage-errors';

export type FileData = Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer> | string | ReadableStream<Uint8Array<ArrayBuffer>>;

export interface FileInfo {
  name: string;
  size: number;
  lastModified: number;
}

/** Large per-game files, such as imported music. Writes replace a file only once they finish. */
export interface GameFiles {
  /**
   * Checks that storage really works. `features.has('files')` can only check that the browser has
   * OPFS, and Safari refuses it in private sessions, where other calls reject with `STORAGE_UNAVAILABLE`.
   */
  available(): Promise<boolean>;
  write(name: string, data: FileData): Promise<void>;
  read(name: string): Promise<File | undefined>;
  /** Returns `false` if the file didn't exist. */
  delete(name: string): Promise<boolean>;
  list(): Promise<FileInfo[]>;
}

function assertName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name === '') {
    throw new GamingaloError('INVALID_ARGUMENT', 'A file name must be a non-empty string.');
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'NotFoundError';
}

/** Names are encoded so that any text is safe, including slashes and `..`. */
function encodeName(name: string): string {
  return `f-${encodeURIComponent(name)}`;
}

function decodeName(stored: string): string {
  return decodeURIComponent(stored.slice(2));
}

type IterableDirectory = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

export function createOpfsFiles(gameId: string, getRoot: () => Promise<FileSystemDirectoryHandle>): GameFiles {
  const directory = async (): Promise<FileSystemDirectoryHandle> => {
    const root = await getRoot();
    return root.getDirectoryHandle(`gamingalo-${gameId}`, { create: true });
  };

  return {
    available: async () => {
      try {
        await directory();
        return true;
      } catch {
        return false;
      }
    },
    write: async (name, data) => {
      assertName(name);
      try {
        const handle = await (await directory()).getFileHandle(encodeName(name), { create: true });
        const writable = await handle.createWritable();
        if (data instanceof ReadableStream) {
          // `pipeTo` closes the file on success and aborts it on failure.
          await data.pipeTo(writable);
          return;
        }
        try {
          await writable.write(data);
          await writable.close();
        } catch (error) {
          await writable.abort().catch(() => {});
          throw error;
        }
      } catch (error) {
        throw toStorageError(error);
      }
    },
    read: async (name) => {
      assertName(name);
      try {
        const stored = await (await (await directory()).getFileHandle(encodeName(name))).getFile();
        return new File([stored], name, { type: stored.type, lastModified: stored.lastModified });
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw toStorageError(error);
      }
    },
    delete: async (name) => {
      assertName(name);
      try {
        await (await directory()).removeEntry(encodeName(name));
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw toStorageError(error);
      }
    },
    list: async () => {
      try {
        const found: FileInfo[] = [];
        for await (const entry of (await directory() as IterableDirectory).values()) {
          if (entry.kind !== 'file' || !entry.name.startsWith('f-')) continue;
          const file = await (entry as FileSystemFileHandle).getFile();
          found.push({ name: decodeName(entry.name), size: file.size, lastModified: file.lastModified });
        }
        return found;
      } catch (error) {
        throw toStorageError(error);
      }
    },
  };
}

export function createMemoryFiles(now: () => number = Date.now): GameFiles {
  const files = new SafeMap<string, File>();
  return {
    available: async () => true,
    write: async (name, data) => {
      assertName(name);
      const blob = await new Response(data as BodyInit).blob();
      files.set(name, new File([blob], name, { lastModified: now() }));
    },
    read: async (name) => {
      assertName(name);
      return files.get(name);
    },
    delete: async (name) => {
      assertName(name);
      return files.delete(name);
    },
    list: async () => {
      const found: FileInfo[] = [];
      files.forEach((file, name) => found.push({ name, size: file.size, lastModified: file.lastModified }));
      return found;
    },
  };
}

/** Returns `undefined` where the browser can't write files to OPFS. */
export function getBrowserFiles(gameId: string): GameFiles | undefined {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  const handle = typeof FileSystemFileHandle === 'undefined' ? undefined : FileSystemFileHandle;
  if (typeof storage?.getDirectory !== 'function' || typeof handle?.prototype.createWritable !== 'function') {
    return undefined;
  }
  return createOpfsFiles(gameId, () => storage.getDirectory());
}
