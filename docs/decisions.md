# Decisions

Status meanings:

* **Decided**: confirmed by the project owner.
* **Default**: proposed in the requirements review. Work may proceed on it until the owner overrides it.
* **Open**: needs an answer from the owner. Work that depends on it must stop.

| ID | Topic | Status | Decision or question | Affects |
|---|---|---|---|---|
| D-01 | CLI framework | Default | Use commander. picocli is a Java framework and does not fit the TypeScript and Node.js stack. | CLI-001 |
| D-02 | UI components | Default | Use PrimeNG with Tailwind and Lucide. Drop shadcn, which is React-only. | WEB-001 |
| D-03 | Game config file | Default | Use `gamingalo.json`. This replaces `gameSettings.json`. | CLI-002 |
| D-04 | Schema source | Default | Zod is the source of truth. JSON Schema is generated from it. | CLI-002, XC-014 |
| D-05 | Backend stack | Default | TypeScript on Node.js with Fastify, PostgreSQL, Redis, S3 and CloudFront on AWS `eu-central-1`. Confirm in the `platform-contracts` spec. | BE-001 |
| D-06 | First engines | Default | Three.js, then Godot to prove the WASM bridge. | WRAP-002, WRAP-003 |
| D-07 | Ranked play | Default | No ranked play at launch. Rely on server-side score validation and defer risk scoring to Phase 4. | BE-011, BE-021 |
| D-08 | Free-tier funding | Open | Who pays for free cloud saves (200 MB per user in the draft), TURN relay traffic and moderation? Should Phase 1 enforce a smaller quota until the cost model exists? | XC-016, BE-006, BE-016, BE-013 |
| D-09 | Meaning of "Budget" | Decided | A general term for technical budgets: bundle size, performance and similar limits. | CLI-008, CLI-010 |
| D-10 | Meaning of "Preferences AI" | Open | What should this feature do? It stays unscheduled until defined. | SDK-036 |
| D-11 | Achievements and trophies | Default | Achievements are defined by each game. Trophies are platform-wide rewards. | BE-010, SDK-013 |
| D-12 | NFT and web3 | Default | Parked. Platform points move forward only after legal review. | WEB-017, WEB-021 |
| D-13 | Game isolation | Default | Each game runs in a sandboxed iframe on its own subdomain of a separate registrable domain, listed on the Public Suffix List. The platform passes scoped game tokens through a bridge. | XC-002, BE-005, WEB-003 |
| D-14 | SDK delivery | Default | The SDK is pinned inside the signed game build. Auto-update is opt-in through a separately signed loader. | XC-004, SDK-034 |
| D-15 | Merchant of record | Open | Which payment provider should handle tax, refunds and payouts? Needed before the Phase 2 `payments` spec is approved. | BE-008, BE-009 |
| D-16 | Anti-automation | Default | Collect risk signals and score them on the server. Do not promise to block automation or AI. | SDK-031, BE-021 |
| D-17 | One Time API meaning | Default | An atomic server-side claim scoped to game, profile and key. Requires a connection and is safe to retry. | SDK-017, BE-014 |
| D-18 | Fingerprinting | Default | Use a first-party ID for stats. Any fingerprinting requires consent and legal approval, and is never exposed to games. | WRAP-005 |
| D-20 | Mock mode | Decided | Mock mode stays, for game makers' tests only. It lives in `@gamingalo/sdk/testing`, is refused outside a test context, and can't reach production builds. | SDK-039 |
| D-21 | SDK access | Decided | The public SDK is frozen and protected from prototype pollution. One reference exists per realm, and it can be bound to specific origins, a frame type and a canvas. | SDK-037, SDK-038 |
| D-22 | Zod in the SDK runtime | Default | The SDK's production code doesn't use Zod, because its parsers read inherited properties, which conflicts with D-21. Zod stays the default everywhere else. | SDK-037 |
| D-19 | SDK shape | Decided | The SDK is a plain library: a facade whose methods come from feature functions. Basic use runs entirely inside the library, with no backend or API of its own. Only extended online features call a foreign API. | All SDK requirements, BE-001 |
