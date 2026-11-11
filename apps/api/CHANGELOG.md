# Changelog

All notable changes to `@gamingalo/api` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-11-11

### Added

* `GET /v1/meta` reports supported format versions.
* Manifests carry a signed format version.

## [0.3.0] - 2026-11-11

### Added

* Game registry with immutable versions, and production and preview channels with rollback.
* Uploads from Ed25519-signed manifests, with every file checked against its hash. Identical files are stored once.
* A games server that serves each game from its own origin with a strict Content Security Policy.
* API tokens for the CLI, play tokens for games, and `/v1/game/me` with a different player ID for each game.
* Public catalog and game information.
* Hourly removal of expired sessions, tokens and challenges, and of abandoned guest accounts.

## [0.2.0] - 2026-11-11

### Added

* Guest accounts, passkey sign-in and upgrade, and sessions in secure cookies.
* Display names, consents, data export and account deletion.
* Origin checks on state-changing requests, and rate limits on sign-in routes.
* Configuration for the web origin, passkey relying party and cookies.

## [0.1.0] - 2026-11-01

### Added

* Service skeleton with health, readiness and metadata routes.
* PostgreSQL in production and PGlite in development and tests, with ordered migrations.
* Shared error responses, request IDs, structured logs, security headers and a CORS allowlist.
