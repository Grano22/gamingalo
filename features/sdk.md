# SDK requirements

Core library for game makers: a single public facade whose methods come from plain feature functions. Basic use runs entirely inside the library. Only extended online features call a foreign API (D-19).

## Core

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-001 | Typed public facade with initialization, lifecycle and feature discovery | Original | P1 |
| SDK-002 | Auth bridge to the platform using scoped game tokens, never platform session tokens | Proposed | P1 |
| SDK-009 | Consistent error model and defined offline behavior for every API | Proposed | P1 |
| SDK-034 | Opt-in SDK auto-update through a separately signed loader | Original | P2 |
| SDK-037 | Frozen public surface with no prototype, protected from prototype pollution and from overriding after load | Proposed | P1 |
| SDK-038 | One reference per realm, with no global or lookup, optionally bound to origins, a frame type and a canvas | Proposed | P1 |
| SDK-039 | Mock mode for game makers' tests only, in a separate entry point that can't reach production | Proposed | P1 |
| SDK-040 | Plugin system: game makers add optional modules to the SDK, which stay out of the core bundle (D-24) | Original | P1 |

## Game memory and sync

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-003 | Unified local persistence across IndexedDB, OPFS and CacheStorage, with `storage.persist()`, quota checks and eviction recovery | Original | P1 |
| SDK-004 | Session-only memory and cache API | Original | P1 |
| SDK-005 | Save slots with schema versions and migrations, including player-created items such as a club logo | Proposed | P1 |
| SDK-006 | Data Sync API: sync on load and during play, with conflict resolution that never silently discards progress | Original | P1 |
| SDK-041 | Online connection: the SDK connects to the Gamingalo platform or to a custom server, with basic use still needing neither (D-23) | Original | P1 |
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
| SDK-036 | Preferences API: custom game settings defined by the game and chosen by the player, separate from the developer-level Settings API (D-10) | Original | P1 |

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
| SDK-022 | Matchmaking and lobbies client, working with the platform and with custom servers | Proposed | P3 |
| SDK-042 | Game modes defined by a game or custom server, with different matchmaking rules for each | Original | P3 |
| SDK-023 | Network API: game network session ID, ping, jitter, throughput and coarse region | Changed | P3 |

## Player experience

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-018 | Accessibility: high-contrast filters, `prefers-contrast` and `forced-colors` support, ARIA mirror of game UI, optional speech output | Changed | P2 |
| SDK-019 | Localization API: messages, locale detection and fallback, plurals, text direction, number and date formatting (i18n) | Original | P1 |
| SDK-024 | Capture API: screenshots, recordings and streaming, saved as public or private on the profile or downloaded locally | Original | P3 |

## Content protection and integrity

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| SDK-028 | Protected assets: encrypted delivery, per-player watermarking and guidance on moving secret logic to the server | Changed | P4 |
| SDK-029 | Protected cutscenes and music through EME in an HTML media overlay | Changed | P4 |
| SDK-030 | No-capture sections that games can mark, enforced by the Capture API | Proposed | P4 |
| SDK-031 | Anti-automation risk signals: input origin, WebDriver and CDP hints, behavior. Must not block assistive technology | Changed | P4 |
| SDK-032 | Signed test mode so game makers and CI can automate their own builds | Proposed | P4 |
