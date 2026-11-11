# Versioning and migrations

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** XC-021
* **Depends on:** `backend-core_0.1.0`, `sdk-initiation_0.0.1`
* **Decisions:** D-28

## Problem

A future `gamingalo migrate` command (CLI-011) will move projects, saves and stored data between versions. That only works if everything says which version of its format it is, and if each change has a deterministic step.

## Scope

### In scope

* A format version on everything stored or exchanged.
* A shared migration chain in `@gamingalo/contracts`.
* Services, the SDK and packages report their versions.

### Out of scope

* The `migrate` command itself (CLI-011).

## Behavior

| What | Version | Where it's recorded |
|---|---|---|
| Packages and apps | Semantic version | `package.json` and `CHANGELOG.md` |
| Web services API | `v1` | The URL path, and `formats.api` in `GET /v1/meta` |
| `gamingalo.json` | `schemaVersion` | The file. Missing means 1. |
| Signed manifest | `formatVersion` | The manifest. It's signed, so it can't be relabelled. |
| SDK browser storage | `STORAGE_FORMAT_VERSION` | `gamingalo:<gameId>:format` in `localStorage`, written once and never overwritten. Missing means 1. |
| Game saves | The game's own `version` | Each save record (SDK-005) |
| Database | Migration IDs | `schema_migrations` |
| SDK | `Gamingalo.version`, `SDK_VERSION` | Set from `package.json` at build time |

Rules:

* A change that older readers can't handle bumps the format version, and adds a migration step in the same commit.
* Steps are keyed by the version they start from, and convert to the next one. They may also convert back, where that loses no data.
* Migrating applies each step in order, in either direction. It fails with a clear message if a step is missing or a version is newer than the tool supports. It never guesses, and never changes its input.
* The same input always produces the same output, so migrations can be tested and repeated.
* `GET /v1/meta` reports the format versions the service supports, so the CLI can tell what it needs to migrate before publishing.

## Acceptance criteria

* [x] AC-1: Chains migrate up and down step by step, and refuse missing steps and unknown versions.
* [x] AC-2: Migrations are deterministic and don't change their input.
* [x] AC-3: `gamingalo.json` and manifests carry their format versions, and the manifest's is signed.
* [x] AC-4: The SDK reports its version, and records its storage format without overwriting another version's.
* [x] AC-5: `GET /v1/meta` reports supported format versions.

## Test plan

* Vitest in contracts, the SDK and the API.

## Tasks

* [x] Format versions and migration chains
* [ ] `gamingalo migrate` (CLI-011)

## Open questions

None.
