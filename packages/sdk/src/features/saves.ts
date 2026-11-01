import { GamingaloError } from '@gamingalo/errors';
import type { KeyValueStore } from './settings';
import { toStorageError } from './storage-errors';

export interface SaveRecord<T = unknown> {
  slot: string;
  version: number;
  updatedAt: number;
  data: T;
}

export type SaveInfo = Omit<SaveRecord, 'data'>;

export interface SaveSchema {
  /** The save format this build of the game uses. A positive whole number. */
  version: number;
  /** Each key converts a save from that version to the next: `{ 1: (v1) => v2 }`. */
  migrations?: Record<number, (data: never) => unknown>;
}

export interface Saves {
  /** Sets the current save format. Defaults to version 1 with no migrations. */
  configure(schema: SaveSchema): void;
  write(slot: string, data: unknown): Promise<SaveInfo>;
  /** Upgrades older saves and stores the result. Returns `undefined` for an empty slot. */
  read<T = unknown>(slot: string): Promise<SaveRecord<T> | undefined>;
  list(): Promise<SaveInfo[]>;
  delete(slot: string): Promise<void>;
  /** Returns `true` once if the browser removed saves. It can't detect every case, such as Safari clearing all site data. */
  wasEvicted(): Promise<boolean>;
}

/** Where records are kept. `put` replaces a whole record, so a failed write leaves the old one intact. */
export interface SaveBackend {
  get(slot: string): Promise<SaveRecord | undefined>;
  put(record: SaveRecord): Promise<void>;
  delete(slot: string): Promise<void>;
  getAll(): Promise<SaveRecord[]>;
  /** Releases resources when the SDK shuts down. */
  close(): void;
}

export function createMemorySaveBackend(): SaveBackend {
  const records = new Map<string, SaveRecord>();
  return {
    get: async (slot) => {
      const record = records.get(slot);
      return record && structuredClone(record);
    },
    put: async (record) => void records.set(record.slot, structuredClone(record)),
    delete: async (slot) => void records.delete(slot),
    getAll: async () => structuredClone([...records.values()]),
    close: () => {},
  };
}

const BLOB_TAG = '$gamingaloBlob';

interface EncodedBlob {
  [BLOB_TAG]: true;
  type: string;
  bytes: ArrayBuffer;
  file?: { name: string; lastModified: number };
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Replaces Blobs inside arrays and plain objects with their bytes, because WebKit can refuse to
 * store Blobs in IndexedDB. Handles shared and circular references.
 */
export async function encodeBlobs(value: unknown, seen = new Map<object, unknown>()): Promise<unknown> {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Blob) {
    const encoded: EncodedBlob = { [BLOB_TAG]: true, type: value.type, bytes: await value.arrayBuffer() };
    if (value instanceof File) encoded.file = { name: value.name, lastModified: value.lastModified };
    seen.set(value, encoded);
    return encoded;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(await encodeBlobs(item, seen));
    return copy;
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(copy, key, {
        value: await encodeBlobs(item, seen),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return copy;
  }
  return value;
}

/** Reverses `encodeBlobs`, changing the freshly read value in place. */
export function decodeBlobs(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    seen.set(value, value);
    value.forEach((item, index) => {
      value[index] = decodeBlobs(item, seen);
    });
    return value;
  }
  if (!isPlainObject(value)) return value;

  if (value[BLOB_TAG] === true) {
    const { type, bytes, file } = value as unknown as EncodedBlob;
    const blob = file
      ? new File([bytes], file.name, { type, lastModified: file.lastModified })
      : new Blob([bytes], { type });
    seen.set(value, blob);
    return blob;
  }
  seen.set(value, value);
  for (const key of Object.keys(value)) {
    Object.defineProperty(value, key, {
      value: decodeBlobs(value[key], seen),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return value;
}

function decodeRecord(record: SaveRecord): SaveRecord {
  return { ...record, data: decodeBlobs(record.data) };
}

export function createIndexedDbSaveBackend(gameId: string, factory: IDBFactory): SaveBackend {
  const STORE = 'saves';
  let opening: Promise<IDBDatabase> | undefined;

  const open = () => {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(`gamingalo:${gameId}`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'slot' });
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new DOMException('Database upgrade is blocked.', 'InvalidStateError'));
      request.onsuccess = () => {
        const database = request.result;
        // Let other tabs upgrade the database in future, and reopen on the next call.
        database.onversionchange = () => {
          database.close();
          opening = undefined;
        };
        database.onclose = () => {
          opening = undefined;
        };
        resolve(database);
      };
    }).catch((error: unknown) => {
      opening = undefined;
      throw error;
    });
    return opening;
  };

  /** Resolves only after the transaction commits, so a reported success is really stored. */
  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      let request: IDBRequest<T>;
      try {
        request = action(transaction.objectStore(STORE));
      } catch (error) {
        // `put` throws synchronously for data that can't be cloned.
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };

  return {
    get: async (slot) => {
      const record = await run<SaveRecord | undefined>('readonly', (store) => store.get(slot));
      return record && decodeRecord(record);
    },
    put: async (record) => {
      // Encoded first, because an IndexedDB transaction can't stay open across this await.
      const encoded = { ...record, data: await encodeBlobs(record.data) };
      await run('readwrite', (store) => store.put(encoded));
    },
    delete: async (slot) => void (await run('readwrite', (store) => store.delete(slot))),
    getAll: async () => (await run<SaveRecord[]>('readonly', (store) => store.getAll())).map(decodeRecord),
    close: () => {
      void opening?.then((database) => database.close()).catch(() => {});
      opening = undefined;
    },
  };
}

function toInfo({ slot, version, updatedAt }: SaveRecord): SaveInfo {
  return { slot, version, updatedAt };
}

export interface SavesOptions {
  gameId: string;
  backend: SaveBackend;
  /** Holds the marker used to detect eviction. */
  markers: KeyValueStore | undefined;
  now?: () => number;
}

export function createSaves(options: SavesOptions): Saves {
  const { backend, markers, now = Date.now } = options;
  const markerKey = `gamingalo:${options.gameId}:saves-exist`;
  let schema: Required<SaveSchema> = { version: 1, migrations: {} };

  // A failure here only weakens eviction detection, so it must never fail the save itself.
  const setMarker = (value: '0' | '1') => {
    try {
      markers?.setItem(markerKey, value);
    } catch {
      // Storage is blocked or full.
    }
  };
  const readMarker = () => {
    try {
      return markers?.getItem(markerKey);
    } catch {
      return null;
    }
  };

  const assertSlot = (slot: unknown) => {
    if (typeof slot !== 'string' || slot === '') {
      throw new GamingaloError('INVALID_ARGUMENT', 'A save slot must be a non-empty string.');
    }
  };

  const attempt = async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      throw toStorageError(error);
    }
  };

  const migrate = (record: SaveRecord): SaveRecord => {
    let data = record.data;
    for (let version = record.version; version < schema.version; version++) {
      const step = schema.migrations[version];
      if (!step) {
        throw new GamingaloError('SAVE_MIGRATION_FAILED', `No migration from save version ${version}.`);
      }
      try {
        data = step(data as never);
      } catch (cause) {
        throw new GamingaloError('SAVE_MIGRATION_FAILED', `Migration from save version ${version} failed.`, { cause });
      }
    }
    return { ...record, version: schema.version, data };
  };

  return {
    configure(next) {
      if (!Number.isInteger(next?.version) || next.version < 1) {
        throw new GamingaloError('INVALID_ARGUMENT', 'The save version must be a positive whole number.');
      }
      schema = { version: next.version, migrations: next.migrations ?? {} };
    },

    async write(slot, data) {
      assertSlot(slot);
      const record: SaveRecord = { slot, version: schema.version, updatedAt: now(), data };
      await attempt(() => backend.put(record));
      setMarker('1');
      return toInfo(record);
    },

    async read<T>(slot: string) {
      assertSlot(slot);
      const record = await attempt(() => backend.get(slot));
      if (!record) return undefined;
      if (record.version > schema.version) {
        throw new GamingaloError(
          'SAVE_VERSION_TOO_NEW',
          `Save "${slot}" uses version ${record.version}, but this game supports up to ${schema.version}.`,
        );
      }
      if (record.version === schema.version) return record as SaveRecord<T>;

      const migrated = migrate(record);
      await attempt(() => backend.put(migrated));
      return migrated as SaveRecord<T>;
    },

    async list() {
      return (await attempt(() => backend.getAll())).map(toInfo);
    },

    async delete(slot) {
      assertSlot(slot);
      await attempt(() => backend.delete(slot));
      if ((await attempt(() => backend.getAll())).length === 0) setMarker('0');
    },

    async wasEvicted() {
      if (readMarker() !== '1') return false;
      if ((await attempt(() => backend.getAll())).length > 0) return false;
      setMarker('0');
      return true;
    },
  };
}

/** Returns the backend for this browser, or `undefined` where IndexedDB is missing or blocked. */
export function getBrowserSaveBackend(gameId: string): SaveBackend | undefined {
  try {
    return typeof indexedDB === 'undefined' ? undefined : createIndexedDbSaveBackend(gameId, indexedDB);
  } catch {
    return undefined;
  }
}
