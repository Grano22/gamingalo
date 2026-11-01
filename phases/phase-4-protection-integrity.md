# Phase 4: Protection and integrity

**Goal:** make content theft and cheating more expensive, and be honest about the limits. The threat model decides how much of this phase to build.

**Before starting:** revisit D-07 and D-16 with real abuse data from Phases 2 and 3.

## Specs

| Spec | Covers | Status |
|---|---|---|
| `asset-protection_0.1.0` | BE-022, CLI-009, SDK-028, SDK-030 | Not started |
| `protected-media_0.1.0` | SDK-029 | Not started |
| `game-integrity_0.1.0` | BE-021, SDK-027, SDK-031, SDK-032 | Not started |

## Exit criteria

* [ ] Assets are encrypted on the CDN, and a leaked asset can be traced to an account by its watermark in a sample game.
* [ ] A protected cutscene plays in every browser in the support matrix, or falls back as the game defined.
* [ ] Marked no-capture sections are excluded from Capture API output.
* [ ] An external penetration test records how long extraction takes. Results are shared with game makers.
* [ ] Screen readers, switch devices and voice control work on a protected sample game, with no penalty.
* [ ] A signed test mode build can be automated in CI, and the token doesn't work in production.
* [ ] False-positive rates are measured, and no automatic ban happens without an appeal route.

## Risks

* Protection can hurt loading speed and compatibility. Measure against the budgets in CLI-010.
* False bans do more damage than most cheats. Start in report-only mode.
* Treat the wording of marketing and game maker documentation as part of this phase. Never promise that extraction is impossible.
