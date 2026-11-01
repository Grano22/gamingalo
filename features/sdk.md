# SDK requirements

Core library for game makers, exposed as a single public facade.

## Core

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-001 | Typed public facade with initialization, lifecycle and feature discovery | Original | P1 |
| SDK-002 | Auth bridge to the platform using scoped game tokens, never platform session tokens | Proposed | P1 |
| SDK-009 | Consistent error model and defined offline behavior for every API | Proposed | P1 |
| SDK-034 | Opt-in SDK auto-update through a separately signed loader | Original | P2 |

## Game memory and sync

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-003 | Unified local persistence across IndexedDB, OPFS and CacheStorage, with `storage.persist()`, quota checks and eviction recovery | Original | P1 |
| SDK-004 | Session-only memory and cache API | Original | P1 |
| SDK-005 | Save slots with schema versions and migrations, including player-created items such as a club logo | Proposed | P1 |
| SDK-006 | Online sync on load and during play, with conflict resolution that never silently discards progress | Original | P1 |
| SDK-025 | Import of player files such as music for a custom radio, with moderation before public sharing | Original | P3 |
| SDK-026 | Loading of purchased or free marketplace add-ons | Original | P5 |
| SDK-027 | Secured memory as a tamper deterrent, with tamper detection reported to the game | Changed | P4 |

## Device and settings

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-007 | Environment API for browser, capabilities, devices, displays and hardware. Unavailable values return `unknown`, and results include capability tiers | Changed | P1 |
| SDK-008 | Settings API with custom setting storage and high-level graphics presets that games opt into | Changed | P1 |
| SDK-010 | Input layer with remapping and gamepad, touch, pointer lock and fullscreen support | Proposed | P2 |
| SDK-033 | Asset loading helpers: streaming, content-hash caching and offline packs | Proposed | P2 |
| SDK-036 | "Preferences AI". Undefined, see D-10 | Original | TBD |

## Online services

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-011 | Read the current player profile | Original | P1 |
| SDK-012 | Friends, groups and presence | Original | P2 |
| SDK-013 | Achievements and trophies, see D-11 | Original | P2 |
| SDK-014 | Player scores and leaderboards, validated on the server | Original | P2 |
| SDK-015 | Paywall: paid content loads only after a server entitlement check, with expiring offline licences | Original | P2 |
| SDK-016 | Moderation API for text first, then images and other uploads | Original | P2 |
| SDK-017 | One Time API, see D-17 | Original | P2 |
| SDK-020 | Peer-to-peer multiplayer over WebRTC, with TURN relay to hide player IPs | Original | P3 |
| SDK-021 | Server multiplayer on custom and officially certified servers | Original | P3 |
| SDK-022 | Matchmaking and lobbies client | Proposed | P3 |
| SDK-023 | Network API: game network session ID, ping, jitter, throughput and coarse region | Changed | P3 |

## Player experience

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-018 | Accessibility: high-contrast filters, `prefers-contrast` and `forced-colors` support, ARIA mirror of game UI, optional speech output | Changed | P2 |
| SDK-019 | Localization helpers | Proposed | P2 |
| SDK-024 | Capture API: screenshots, recordings and streaming, saved as public or private on the profile or downloaded locally | Original | P3 |

## Content protection and integrity

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-028 | Protected assets: encrypted delivery, per-player watermarking and guidance on moving secret logic to the server | Changed | P4 |
| SDK-029 | Protected cutscenes and music through EME in an HTML media overlay | Changed | P4 |
| SDK-030 | No-capture sections that games can mark, enforced by the Capture API | Proposed | P4 |
| SDK-031 | Anti-automation risk signals: input origin, WebDriver and CDP hints, behavior. Must not block assistive technology | Changed | P4 |
| SDK-032 | Signed test mode so game makers and CI can automate their own builds | Proposed | P4 |
