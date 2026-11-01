# Phase 0: Foundations

**Goal:** settle the decisions that are expensive to change, and make the repo ready to build in.

## Specs

| Spec | Covers | Status |
|---|---|---|
| `repo-foundation_0.1.0` | XC-015, XC-020 | In progress |
| `security-model_0.1.0` | XC-001 | Not started |
| `platform-contracts_0.1.0` | XC-003, XC-004, XC-014, XC-016 | Not started |

## Order

1. `repo-foundation`
2. `security-model`, which decides what the contracts must enforce
3. `platform-contracts`

## Exit criteria

* [ ] Nx workspace builds, lints and tests in CI.
* [ ] `infra/living_repo` is committed and its README steps work from a clean checkout.
* [ ] The threat model covers saves, paid content, scores, game code and protected assets, and states what we won't defend against.
* [ ] D-05, D-13 and D-14 are confirmed.
* [ ] D-08 is answered using the cost model.
* [ ] A throwaway prototype runs a game on an isolated origin and passes a scoped token through the bridge.
* [ ] Contract tooling generates a typed client from a sample API.

## Risks

* Over-designing contracts for features that are still far off. Only define what P1 needs.
