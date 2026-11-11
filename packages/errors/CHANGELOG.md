# Changelog

All notable changes to `@gamingalo/errors` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-11-11

### Added

* `CONFLICT`, `UNAUTHENTICATED`, `FORBIDDEN`, `REAUTHENTICATION_REQUIRED`, `PARENTAL_CONSENT_REQUIRED` and `RATE_LIMITED` error codes.

## [0.6.0] - 2026-11-01

### Added

* `PLUGIN_FAILED` error code.

## [0.5.0] - 2026-11-01

### Added

* `NOT_FOUND` and `SERVICE_UNAVAILABLE` error codes for web services.

### Fixed

* Error instances are no longer frozen, because that broke loggers and error reporting tools that mark the errors they process. Their fields are read-only instead, and the class and prototype stay frozen.

## [0.4.0] - 2026-11-01

### Added

* `REALM_NOT_ALLOWED` and `MOCK_NOT_ALLOWED` error codes.

### Changed

* **Breaking:** errors, `GamingaloError`, its prototype and `ERROR_DEFINITIONS` are frozen. Classes can't extend `GamingaloError` and add fields.
* `isGamingaloError` checks own properties, so a polluted prototype can't fool it.

## [0.3.0] - 2026-11-01

### Added

* `SAVE_VERSION_TOO_NEW` and `SAVE_MIGRATION_FAILED` error codes.

## [0.2.0] - 2026-11-01

### Added

* `STORAGE_UNAVAILABLE` and `STORAGE_QUOTA_EXCEEDED` error codes.

## [0.1.0] - 2026-11-01

### Added

* `INVALID_ARGUMENT` error code.

## [0.0.1] - 2026-11-01

### Added

* `GamingaloError`, `isGamingaloError` and the first error codes.
