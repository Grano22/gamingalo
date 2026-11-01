# Changelog

All notable changes to `@gamingalo/sdk` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

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
