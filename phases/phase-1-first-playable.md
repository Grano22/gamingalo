# Phase 1: First playable

**Goal:** a game maker publishes with one command, and a player can play the game and keep their saves across devices.

## Specs

| Spec | Covers | Status |
|---|---|---|
| `sdk-initiation_0.0.1` | SDK-001, SDK-009, XC-005 | In progress |
| `sdk-hardening_0.1.0` | SDK-037, SDK-038, SDK-039 | Done |
| `sdk-modules_0.1.0` | SDK-036, SDK-040, PLG-001 | Done |
| `plugin-packages_0.1.0` | SDK-043 | Done |
| `game-skeleton_0.1.0` | CLI-012, XC-022 | Done |
| `release-pipeline_0.1.0` | XC-023 | Done |
| `docs-site_0.1.0` | XC-024 | Done |
| `sdk-localization_0.1.0` | SDK-019 | Done |
| `sdk-connection_0.1.0` | SDK-041 | Not started |
| `versioning_0.1.0` | XC-021 | Done |
| `backend-core_0.1.0` | BE-001, XC-006 | In progress |
| `identity_0.1.0` | BE-002, WEB-004, XC-008, XC-009, XC-010 | In progress |
| `sdk-platform-bridge_0.1.0` | SDK-002, SDK-011 | Done |
| `game-hosting_0.1.0` | BE-003, BE-004, BE-005, WEB-003, XC-002 | In progress |
| `game-memory_0.1.0` | SDK-003, SDK-004, SDK-005, SDK-006, BE-006, WEB-006 | In progress |
| `sdk-device-settings_0.1.0` | SDK-007, SDK-008 | Done |
| `wrapper-adapters_0.1.0` | WRAP-001, WRAP-002, WRAP-003 | Not started |
| `cli-publish_0.1.0` | CLI-001, CLI-002, CLI-003, CLI-004, CLI-005, CLI-006, CLI-008 | In progress |
| `web-shell_0.1.0` | WEB-001, WEB-002, WEB-005, XC-007, XC-017 | In progress |

## Order

The web platform and web services come first, and the SDK connects to them afterwards (D-23). SDK work that needs no connection can continue alongside.

1. `backend-core` and `web-shell`
2. `identity` and `game-hosting`
3. `sdk-connection`, then the online parts of `game-memory`
4. Everything else, in parallel

## Exit criteria

* [ ] A Three.js sample and a Godot sample are published with `gamingalo game:publish` from CI.
* [ ] Publishing fails when a game exceeds a static budget in `gamingalo.json`.
* [ ] An unsigned or tampered upload is rejected.
* [ ] The SDK connects to both the platform and a sample custom server, and works with neither.
* [ ] A sample attack game can't read another game's storage or the player's platform token.
* [ ] A guest can play, upgrade to an account and keep their saves.
* [ ] A save made on one device loads on another. A conflict never silently loses progress.
* [ ] Saves survive going offline and reconnecting. Local eviction is detected and recovered from the cloud.
* [ ] Rollback restores a previous version without affecting saves.
* [ ] A player can export their data and delete their account.
* [ ] End-to-end tests pass across the support matrix, and the platform passes a WCAG 2.2 AA audit.

## Risks

* Godot's web export may limit the bridge or need cross-origin isolation. Test this early.
* Hosting third-party code is risky. Keep this phase invitation-only and review each game.
