# Changelog: @gamingalo/sdk 0.0.1 to 0.13.0

Archived from CHANGELOG.md. Newer versions are in [../CHANGELOG.md](../CHANGELOG.md).

## [0.13.0] - 2026-11-11

### Added

* `Gamingalo.version`, `SDK_VERSION` and `STORAGE_FORMAT_VERSION`.
* The storage format is recorded once per game, so later versions can migrate stored data.

## [0.12.0] - 2026-11-11

### Changed

* **Breaking:** `sdk.localization` and `sdk.accessibility` are modules that load only when listed in `init({ modules: ['localization', 'accessibility'] })`. Without that, they throw `FEATURE_UNAVAILABLE`, and `features.has()` reports `false`. This keeps the core download to about 11.5 KB gzipped for games that don't use them.
* `createMockSdk` takes the same `modules` option.

## [0.11.0] - 2026-11-01

### Added

* `sdk.localization`: messages with parameters, plurals and fallback, a saved locale choice, text direction, and number and date formatting.
* `localization.detect()` reports language, region, time zone and keyboard layout with no prompts. Keyboard layout is `unknown` outside Chromium.
* `localization.requestGeolocation()` returns the player's position when they allow it. It runs only when a game calls it.
* `locale` event, and a `localization` mock option.

## [0.10.0] - 2026-11-01

### Added

* Plugin system: list optional modules in `init({ plugins })`, get their API with `sdk.use(plugin)`, and write your own using `GamingaloPlugin`.
* `createMockSdk({ plugins })` and `sdk.mock.canvasFilter()` for testing plugins.

### Changed

* Canvas filters are layered, so plugin, accessibility and the game's own filters combine instead of overwriting each other.

## [0.9.0] - 2026-11-01

### Added

* `sdk.preferences`: custom game settings, with optional definitions for types, defaults and limits, and a `preferences` event.

### Changed

* **Breaking:** `sdk.settings` now holds developer-level graphics controls only. `get`, `set`, `remove` and `all` moved to `sdk.preferences`, where `remove` is now `reset`. Values stored by earlier versions aren't migrated, since the SDK hasn't been released.

## [0.8.1] - 2026-11-01

### Fixed

* `GamingaloError` instances are no longer frozen, because that broke loggers and error reporting tools. Their fields are read-only instead.

## [0.8.0] - 2026-11-01

### Added

* `sdk.network`: a random session ID, browser connection info, and `measure()` for ping, jitter, request loss and throughput against a URL the game chooses. It sends nothing until called, and never exposes IP or MAC addresses.
* `network` mock option and `sdk.mock.setNetwork()`.

## [0.7.0] - 2026-11-01

### Added

* `sdk.accessibility`: player preferences, an ARIA mirror of game UI, live announcements, contrast and grayscale filters for the bound canvas, and optional speech.
* `accessibility` event when a preference changes.
* `sdk.mock.accessibility` for checking announcements, mirror items and activation in tests.

## [0.6.0] - 2026-11-01

### Added

* `sdk.files`: per-game storage for large files in OPFS, accepting Blobs, buffers, text and streams. A failed write leaves the previous file intact.
* `sdk.files.available()` checks that storage really works, because Safari refuses OPFS in private sessions.
* `files` in `features.has()`, and memory-backed files in mock mode.

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
