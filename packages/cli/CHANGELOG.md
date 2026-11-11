# Changelog

All notable changes to `@gamingalo/cli` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-11

### Added

* `login` and `logout`, with `GAMINGALO_TOKEN` and `GAMINGALO_API_URL` for CI.
* `game:create`, `game:keys:create`, `game:validate`, `game:publish`, `game:versions`, `game:promote` and `game:rollback`.
* Static budgets from `gamingalo.json`, checked before publishing.
* Signed manifests, and uploads of only the files the platform doesn't already have.
