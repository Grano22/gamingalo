# Phase 2: Social and monetization

**Goal:** players connect, creators earn money, user content is moderated, and the platform is ready for public launch.

**Before starting:** answer D-15. Get legal review of payments, age handling and DSA duties.

## Specs

| Spec | Covers | Status |
|---|---|---|
| `social_0.1.0` | BE-012, SDK-012, WEB-007 | Not started |
| `progression_0.1.0` | BE-010, BE-011, SDK-013, SDK-014, WEB-008 | Not started |
| `payments_0.1.0` | BE-007, BE-008, BE-009, SDK-015, WEB-009 | Not started |
| `moderation_0.1.0` | BE-013, SDK-016, WEB-011, XC-011, XC-012, XC-013 | Not started |
| `one-time-actions_0.1.0` | BE-014, SDK-017 | Not started |
| `analytics_0.1.0` | BE-015, BE-020, BE-024, WRAP-005, WEB-010 | Not started |
| `player-experience_0.1.0` | SDK-010, SDK-018, SDK-019, SDK-033, SDK-034, WEB-012, WRAP-006, XC-018 | Not started |
| `creator-tooling_0.2.0` | CLI-007, CLI-010, WRAP-004 | Not started |
| `mcp-public_0.1.0` | MCP-002, MCP-003, MCP-004, MCP-005 | Not started |

## Order

`moderation` starts first, or at least alongside `social`, because no public user content can ship without it.

## Exit criteria

* [ ] A forged client score is rejected or flagged.
* [ ] A locked paid asset can't be downloaded without an entitlement, including by replaying an expired URL.
* [ ] A real test purchase completes with correct VAT, can be refunded, and appears in creator revenue reports.
* [ ] Concurrent one-time claims produce exactly one success.
* [ ] A report can go through review, decision, statement of reasons and appeal.
* [ ] Stats reports contain no raw IPs or fingerprints, and small groups are hidden.
* [ ] `game:budget` reports load time, frame time and memory in a real browser, and can fail a CI run.
* [ ] A screen reader user can navigate a sample game's menus using the ARIA layer.
* [ ] Quick Resume restores a sample game after the browser is closed.
* [ ] Private profiles never appear in MCP results.

## Risks

* Moderation needs people as well as software. Staff and fund review before launch.
* Payment provider terms may restrict certain game content or regions.
