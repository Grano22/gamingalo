# Cross-cutting requirements

All entries are proposed. The legal items need review by a qualified lawyer before launch.

## Security and architecture

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| XC-001 | Threat model: for each asset, the attacker, the defense and the accepted risk | Proposed | P0 |
| XC-002 | Game isolation: separate origins, CSP and no platform tokens in game code | Proposed | P1 |
| XC-004 | SDK versioning and compatibility policy, see D-14 | Proposed | P0 |
| XC-014 | API contracts for HTTP and realtime traffic, with generated clients | Proposed | P0 |

## Engineering

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| XC-003 | Browser support matrix, including mobile and the WebGL2 fallback | Proposed | P0 |
| XC-005 | Shared error codes across SDK, backend and CLI | Proposed | P1 |
| XC-006 | Observability: logs, metrics, traces and service-level objectives | Proposed | P1 |
| XC-007 | Playwright end-to-end tests across the support matrix | Proposed | P1 |
| XC-015 | Nx monorepo with CI, linting and test setup | Proposed | P0 |
| XC-016 | Cost model for free-tier saves, relay traffic and moderation, see D-08 | Proposed | P0 |
| XC-017 | Web platform meets WCAG 2.2 AA | Proposed | P1 |
| XC-018 | Localization of platform and SDK strings | Proposed | P2 |
| XC-020 | Infrastructure housekeeping: keep the `infra/living_repo` README accurate and validate the OpenTofu roots in CI | Proposed | P0 |

## Privacy and compliance

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| XC-008 | GDPR data export and account deletion | Proposed | P1 |
| XC-009 | Consent management | Proposed | P1 |
| XC-010 | Age check at sign-up, with a minor-safe default experience | Proposed | P1 |
| XC-011 | Parental controls | Proposed | P2 |
| XC-012 | DSA notice-and-action, statements of reasons and appeals | Proposed | P2 |
| XC-013 | Age ratings for games | Proposed | P2 |
