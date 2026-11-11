# Changelog

All notable changes to `@gamingalo/contracts` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-11-11

### Added

* `pluginManifestSchema`, for the `gamingalo` field that makes a package a plugin.
* `plugins` in `gamingalo.json`, for plugin options, or `false` to turn a plugin off.

### Changed

* `gamingalo.json` is now format version 2. Version 1 files migrate automatically, and convert back only if they have no plugin options.

## [0.4.0] - 2026-11-11

### Added

* `FORMAT_VERSIONS`, `createMigrationChain()` and `readFormatVersion()`, for deterministic migrations between format versions.
* `schemaVersion` in `gamingalo.json`, and `parseGameConfig()`, which migrates older files before validating them.
* `formats` in the service metadata response.

### Changed

* **Breaking:** manifests need `formatVersion`, which is part of the signed bytes.

## [0.3.0] - 2026-11-11

### Added

* Schemas for games, versions, channels, signed manifests, uploads, API tokens, play tokens and player profiles.
* `gamingalo.json` schema, with a generated JSON Schema at `@gamingalo/contracts/gamingalo.schema.json`.
* `canonicalManifest()`, which defines the exact bytes the CLI signs and the server verifies.
* Allowed file types for games, and `contentTypeFor()`.

## [0.2.0] - 2026-11-11

### Added

* Schemas for guest accounts, profiles, consents, data export, account deletion and passkeys.

## [0.1.0] - 2026-11-01

### Added

* Schemas for the error response, health, readiness and service metadata.
