# Game memory

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** SDK-003, SDK-004, SDK-005, SDK-006, BE-006, WEB-006
* **Depends on:** `sdk-initiation_0.0.1`
* **Decisions:** D-08 (cloud part only), D-19

## Problem

Games need a simple, reliable place for session data, cached files and player saves, without dealing with several browser storage APIs and their failure modes.

## Scope

### In scope for this increment: local memory, no backend

* `sdk.session`: memory that lasts until shutdown or page close.
* `sdk.cache`: downloadable or generated files that the browser may discard.
* `sdk.saves`: save slots with schema versions and migrations, including binary data such as a club logo.
* `sdk.storage`: usage, quota and requests for persistent storage.
* `sdk.files`: large files such as imported music, using OPFS.

### Later increments

* Online sync through a foreign API, and the backend and platform parts (SDK-006, BE-006, WEB-006). The cloud quota depends on D-08.

## Behavior

```ts
sdk.session.set('checkpoint', 3);

await sdk.cache.put('logo.png', blob);
await sdk.cache.get('logo.png');          // Blob | undefined

sdk.saves.configure({
  version: 2,
  migrations: { 1: (old) => ({ ...old, money: 0 }) }, // from version 1 to 2
});
await sdk.saves.write('slot-1', { level: 3, logo: blob });
await sdk.saves.read('slot-1');           // { slot, version, updatedAt, data } | undefined
await sdk.saves.list();                   // the same, without data
await sdk.saves.delete('slot-1');
await sdk.saves.wasEvicted();             // true once, if the browser removed saves

await sdk.storage.estimate();             // { usedBytes, quotaBytes } | 'unknown'
await sdk.storage.requestPersistence();   // boolean
```

Rules:

* All data is stored per game.
* Save data can be anything the browser can structured-clone. Other data rejects with `INVALID_ARGUMENT`.
* Reading an older save runs each migration in order, then stores the result. If a migration fails or is missing, the read rejects with `SAVE_MIGRATION_FAILED` and the stored save is unchanged.
* Reading a save newer than the configured version rejects with `SAVE_VERSION_TOO_NEW`, so an old build can't damage newer data.
* Full storage rejects with `STORAGE_QUOTA_EXCEEDED`. Other storage failures reject with `STORAGE_UNAVAILABLE`. A failed write leaves the previous save intact.
* Without IndexedDB, `features.has('saves')` is `false` and `sdk.saves` throws `FEATURE_UNAVAILABLE`. Saves never silently fall back to memory, because the player would lose progress.
* The cache may fall back to memory, since its contents can always be recreated.
* Without OPFS, `features.has('files')` is `false` and `sdk.files` throws `FEATURE_UNAVAILABLE`.
* WebKit refuses OPFS, and raw Blobs in IndexedDB, in ephemeral sessions like private browsing. Both work in a persistent profile. In a private session, `files.available()` returns `false` and other file calls reject with `STORAGE_UNAVAILABLE`.
* In mock mode, nothing touches browser storage.

## Acceptance criteria

* [x] AC-1: Session values are gone after a shutdown and a new `init`.
* [x] AC-2: Cached files can be stored, read and deleted in Chromium, Firefox and WebKit, and are separate for each game.
* [x] AC-3: Saves, including a Blob, survive a page reload in Chromium, Firefox and WebKit, and are separate for each game.
* [x] AC-4: Migrations follow the rules above, and a failure leaves the save unchanged.
* [x] AC-5: Quota and other storage errors map to the documented codes.
* [x] AC-6: `wasEvicted` reports `true` once when saves disappear unexpectedly, and not after normal deletes.
* [x] AC-7: `storage.estimate` and `requestPersistence` work where supported and never throw where they aren't.
* [x] AC-8: The core bundle stays within budget.
* [x] AC-9: Large files survive a reload in Chromium, Firefox and WebKit, are separate for each game, and a failed write leaves the previous file intact.

## Design

* Plain feature functions in `src/features`, exposed by the facade (D-19).
* Saves use IndexedDB and store whole records, so each write is atomic.
* Blobs and Files inside arrays and plain objects are stored as bytes and restored on read, because WebKit refuses raw Blobs in IndexedDB in ephemeral sessions. A Blob inside a `Map` or `Set` isn't converted, so it can fail in WebKit.
* `requestPersistence` can stay pending while Firefox asks the player, so games shouldn't wait on it during startup.
* Eviction detection uses a marker in `localStorage`. Safari can clear both stores together, in which case eviction can't be detected. Calling `requestPersistence` and using online sync are the real protections.

## Security and privacy

* Local saves are readable and editable by the player. Don't treat them as a source of truth for currency, entitlements or ranked results.

## Test plan

* Vitest using a memory backend for migrations, errors and eviction.
* Playwright for AC-2, AC-3 and AC-7 against real browser storage.

## Tasks

* [x] Session memory and cache
* [x] Saves, migrations and eviction detection
* [x] Storage quota and persistence
* [x] OPFS for large files
* [ ] Online sync through a foreign API
* [ ] Backend and platform parts

## Open questions

None for this increment.
