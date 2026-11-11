# Changelog

All notable changes to `@gamingalo/plugin-screen-preferences` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-11

### Added

* A `gamingalo` manifest in `package.json` and a `gamingaloPlugin` export, so installing the package adds it to the SDK through `@gamingalo/vite-plugin`. Options go in `gamingalo.json` under `plugins`.

### Changed

* Needs `@gamingalo/sdk` 0.14.0 or later.

## [0.1.0] - 2026-11-01

### Added

* Player-adjustable brightness, contrast, saturation and gamma for the bound canvas, saved between sessions.
