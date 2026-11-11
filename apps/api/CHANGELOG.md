# Changelog

All notable changes to `@gamingalo/api` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

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
