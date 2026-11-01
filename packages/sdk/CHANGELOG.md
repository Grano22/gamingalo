# Changelog

All notable changes to `@gamingalo/sdk` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-11-01

### Added

* `realm` option on `init`: restrict the SDK to specific origins, a frame type and a canvas from the same realm. A mismatch rejects with `REALM_NOT_ALLOWED`.
* `sdk.realm` reports the origin, whether the game is embedded, and the bound canvas.
* `@gamingalo/sdk/testing` with `createMockSdk()` for game makers' tests. It's refused outside a test context with `MOCK_NOT_ALLOWED`.

### Changed

* **Breaking:** `Gamingalo`, the SDK reference and every feature API are frozen, with no prototype. Internal code ignores polluted prototypes and built-ins patched after the SDK loads.
* **Breaking:** `init` gives out one reference per realm. While it's running, another `init` rejects with `SDK_ALREADY_INITIALIZED`, even with the same configuration.
* The production bundle no longer contains Zod, reducing it from 13.3 KB to about 7.7 KB gzipped.

### Removed

* **Breaking:** `Gamingalo.instance()`, because any script on the page could use it to get the reference.
* **Breaking:** the `mode` and `mock` options on `init`. Production builds contain no mock code, and the build fails if any reaches them.

### Security

* The SDK must load before other scripts. Protection only covers code that runs after it. Stored data and browser APIs can't be protected from same-origin code, so anything that must be trustworthy has to be decided on a server.

## [0.4.0] - 2026-11-01

### Added

* `sdk.saves`: local save slots using IndexedDB, including binary data such as Blobs.
* Save schema versions with ordered migrations. A failed migration leaves the save unchanged.
* `sdk.saves.wasEvicted()` to detect saves removed by the browser, where detection is possible.
* `sdk.storage`: storage usage and persistence requests.

### Changed

* `features.has('saves')` now reports real availability. In mock mode, saves are available unless `mock.features` is set without them.

## [0.3.0] - 2026-11-01

### Added

* `sdk.session`: memory that lasts until shutdown or page close.
* `sdk.cache`: per-game file cache using the Cache API, with a memory fallback.

## [0.2.0] - 2026-11-01

### Added

* `sdk.settings`: per-game custom settings that persist between sessions and fall back to memory when storage is blocked or full.
* Graphics presets (`auto`, `low`, `medium`, `high`) with recommended values, and a `graphics` event. The SDK doesn't change the renderer.
* `readEnvironment()` and `resolveGraphics()` as standalone functions.

### Changed

* Internal code now lives in plain feature functions behind a thin facade. The public API is unchanged.

## [0.1.0] - 2026-11-01

### Added

* `sdk.environment.read()` reports browser, platform, hardware, graphics, display and device information, plus a capability tier. Values the browser doesn't expose are `unknown`.
* `devices` event when a gamepad or media device is added or removed.
* Mock mode: `mock.environment` overrides and `sdk.mock.devicesChanged()`.

## [0.0.1] - 2026-11-01

### Added

* `Gamingalo.init()`, `Gamingalo.instance()` and `sdk.shutdown()`.
* `suspend`, `resume` and `connection` events.
* `sdk.connection.state` and `sdk.features.has()`.
* Mock mode for development and tests with no backend.
* Shared error model through `GamingaloError`.
