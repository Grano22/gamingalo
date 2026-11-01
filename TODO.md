# TODO

Questions waiting for an answer from the project owner. See the rule in `AGENTS.md` for how to close them.

## Decisions

* [ ] **D-08:** Who pays for free cloud saves (200 MB per user in the draft), TURN relay traffic and moderation? Should Phase 1 enforce a smaller save quota until the cost model exists? Blocks the cloud part of `game-memory`.
* [ ] **D-10:** What should "Preferences AI" do? SDK-036 stays unscheduled until this is defined.
* [ ] **D-15:** Which payment provider should handle tax, refunds and payouts? Needed before the Phase 2 `payments` spec is approved.

## SDK

* [ ] Is 15 KB gzipped the right size budget for the SDK core bundle?
* [ ] Should the npm scope be `@gamingalo`? It hasn't been checked or registered.

## Manual checks

* [ ] Does switching tabs fire `suspend` and `resume` in real Chromium, Firefox and Safari? Automated tests can only simulate it (AC-4 in `sdk-initiation_0.0.1`).
