# Backend requirements

This is the platform's backend, not part of the SDK. The SDK works without it, and calls a foreign API like this one only for extended online features (D-19). All entries are proposed.

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| BE-001 | Deployed service skeleton with API, data store, migrations and environments, see D-05 | Proposed | P1 |
| BE-002 | Identity: guest accounts and upgrades, passkeys and OAuth, account linking, scoped game tokens | Proposed | P1 |
| BE-003 | Game registry with versions and release channels | Proposed | P1 |
| BE-004 | Upload ingestion with signature verification and automated scanning | Proposed | P1 |
| BE-005 | Game hosting and CDN on isolated per-game origins, see D-13 | Proposed | P1 |
| BE-006 | Cloud save API with quotas, version history and conflict detection | Proposed | P1 |
| BE-007 | Entitlements and short-lived signed content URLs | Proposed | P2 |
| BE-008 | Payments through a merchant of record, with EU VAT and refunds, see D-15 | Proposed | P2 |
| BE-009 | Creator revenue reporting and payouts | Proposed | P2 |
| BE-010 | Achievement and trophy service | Proposed | P2 |
| BE-011 | Score validation and leaderboards | Proposed | P2 |
| BE-012 | Social graph: friends, groups, blocks and presence | Proposed | P2 |
| BE-013 | Moderation pipeline with automated checks and human review | Proposed | P2 |
| BE-014 | One-time action ledger with atomic claims | Proposed | P2 |
| BE-015 | Stats ingestion and aggregation, with minimum group sizes in reports | Proposed | P2 |
| BE-016 | WebRTC signaling and TURN relay | Proposed | P3 |
| BE-017 | Matchmaking and lobbies | Proposed | P3 |
| BE-018 | Game server registry and certification program | Proposed | P3 |
| BE-019 | Capture storage and media processing | Proposed | P3 |
| BE-020 | Remote config and feature flags for games | Proposed | P2 |
| BE-021 | Risk scoring and enforcement policy, including appeals | Proposed | P4 |
| BE-022 | Content key and licence service | Proposed | P4 |
| BE-023 | Marketplace catalog, purchases and revenue share | Proposed | P5 |
| BE-024 | Crash and error reporting for games | Proposed | P2 |
