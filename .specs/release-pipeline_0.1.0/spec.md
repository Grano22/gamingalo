# Release pipeline

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** XC-023
* **Depends on:** `repo-foundation_0.1.0`
* **Decisions:** D-31, D-32

## Behavior

* `tools/changelog.mjs` checks every module's changelog, rotates versions beyond 12 into `changelogs/CHANGELOG.<from>.to.<to>.md`, and extracts a version's notes.
* `tools/release-tag.mjs` creates a `<module>-v<version>` tag after checking the changelog and a clean working tree.
* `.github/workflows/release.yml` runs on those tags: it checks the tag against `package.json`, builds and tests the module, publishes public modules to npm with provenance (skipping a version that's already published), and creates a GitHub release with the changelog notes and, for the CLI, standalone binaries with checksums.

## Acceptance criteria

* [x] AC-1: Changelog checks catch too many versions, a version that differs from `package.json`, wrong order, missing notes, duplicates and misnamed archives.
* [x] AC-2: Rotation archives every version but the newest, and the result passes the check. The SDK's 16 versions were rotated.
* [x] AC-3: Release notes come from `CHANGELOG.md` or an archive.
* [x] AC-4: Release tags are parsed and matched to real modules, and mismatched versions are refused.
* [x] AC-5: A standalone CLI binary builds and runs on macOS. The release workflow builds Linux, macOS and Windows binaries.
* [x] AC-6: The workflows validate against GitHub's workflow schema.

## Not verified

* The release workflow hasn't run on GitHub, because nothing is pushed, and it needs the setup in `TODO.md`.
* Only the macOS binary was built locally.
