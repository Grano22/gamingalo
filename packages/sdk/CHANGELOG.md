# Changelog

All notable changes to `@gamingalo/sdk` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

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
