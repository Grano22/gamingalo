# Changelog

All notable changes to `@gamingalo/vite-plugin` are recorded here. This project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-11

### Added

* Finds installed plugin packages by the `gamingalo` field in their `package.json`, and generates `virtual:gamingalo-plugins`.
* Checks each plugin's supported SDK range against the installed SDK, and fails the build with a clear message if it doesn't match.
* Passes plugin options from `gamingalo.json`, and lets `false` turn a plugin off.
