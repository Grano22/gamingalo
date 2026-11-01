# Gamingalo

Web game platform: an SDK for game makers, a game wrapper, a web platform, a backend, a CLI and an MCP server.

## Where things live

| Path | Purpose |
|---|---|
| `features/` | Requirements with stable IDs, grouped by component. The source of truth for what we build. |
| `phases/` | Delivery plan. Each phase lists its specs and exit criteria. |
| `.specs/` | One folder per spec (`<name>_<version>/spec.md`). See `.specs/README.md`. |
| `docs/decisions.md` | Decisions, working defaults and open questions. |
| `TODO.md` | Questions waiting for the project owner's answer. |
| `infra/` | OpenTofu: `bootstrap` (state backend) and `living_repo` (workload). |
| `.draft/` | Original idea notes. Not authoritative. |

## How to work

1. Find the requirement in `features/` and its spec in the current phase. Do not build a feature without a spec.
2. If the spec is missing, create it from `.specs/_template/spec.md` and get it approved before writing code.
3. Implement against the acceptance criteria and reference requirement IDs in tests and PRs.
4. If the work changes a requirement or decision, update `features/` or `docs/decisions.md` in the same change.
5. If a task depends on an `Open` decision, stop and ask.
6. After each completed feature, update versions and changelogs as described below, then commit using [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(sdk): add lifecycle events`.

## Versions and changelogs

Every change to a module's shipped behavior goes in the same commit as these two updates:

1. Bump `version` in the `package.json` of each changed module, following [Semantic Versioning](https://semver.org/):
   * Bug fix: patch.
   * New feature: minor.
   * Breaking change: major. Before 1.0.0, use minor and mark the entry as breaking.
2. Add a section for the new version to that module's `CHANGELOG.md`, in the [Keep a Changelog](https://keepachangelog.com/) format, with the date and what changed for its users.

Tests, internal refactoring and docs alone don't need a bump.

## Open questions

Questions for the project owner go in `TODO.md`. Once one is answered, keep it in the file, strike it through and add the answer:

```md
* [x] ~~Which payment provider should we use?~~ **Answer:** Paddle.
```

Then apply the answer wherever it belongs, such as `docs/decisions.md`.

## Shared tech stack

* Language: TypeScript
* Monorepo: Nx
* Bundler: Vite
* Unit and functional tests: Vitest
* Real-browser end-to-end tests: Playwright
* Schema validation:
  * Zod is the source of truth for internal structures. Exception: the SDK's production code uses own-property checks instead (D-22).
  * JSON Schema for external files such as `gamingalo.json` is generated from Zod.
* Infrastructure: OpenTofu on AWS

## Component tech stack

| Component | Stack |
|---|---|
| SDK | Plain TypeScript library with no framework dependency and no backend of its own. `src/features/*` holds plain feature functions, and `src/facade.ts` only exposes them as methods. Only extended online features call a foreign API (D-19). Entry points: `src/index.ts` (production) and `src/testing.ts` (tests). |
| Game Wrapper | Core SDK plus engine and framework adapters |
| Web Platform | Angular, Vertical Slice Architecture, Testing Library, PrimeNG, Tailwind, Lucide, NgRx Signals |
| Backend | See D-05 in `docs/decisions.md` |
| CLI | TypeScript, Node.js, commander |
| MCP Server | TypeScript, read-only by default |

## Rules that must not be broken

* The client is untrusted. Currency, entitlements, ranked results, scores and one-time actions are decided on the server.
* Describe client-side protection as raising the cost of an attack, never as a guarantee.
* Third-party games run on isolated origins and never receive platform session tokens.
* Never expose raw IP addresses or fingerprints to game code.
* Protection features must not block assistive technology.
* The SDK's public surface stays frozen, with no prototype and no globals. There is one reference per realm, with no way to look it up. Facade and feature code must not read inherited properties, and uses `src/primordials.ts` instead of global built-ins for anything that touches SDK state.
* Mock code lives only behind `@gamingalo/sdk/testing`, and must never reach the production entry point.
* Never commit credentials, state files or real `.tfvars` files.
