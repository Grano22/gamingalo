# Changelog

All notable changes to `@gamingalo/sdk` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

Older versions are in [changelogs/](changelogs/).

## [0.14.1] - 2026-11-11

### Documentation

* Documented the environment, network, storage, cache, files, and session APIs.

## [0.14.0] - 2026-11-11

### Added

* `sdk.player`: the player signed in on the platform, with `profile()` returning a per-game player ID, display name, and whether they're a minor or a guest.
* `platform: { origin }` in `init`. The SDK accepts play tokens only from that origin and the parent frame, and never exposes the token to game code.
* A `player` mock option.
