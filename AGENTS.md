# Gamingalo

Web game platform: an SDK for game makers, a game wrapper, a web platform, a backend, a CLI and an MCP server.

## Where things live

| Path | Purpose |
|---|---|
| `features/` | Requirements with stable IDs, grouped by component. The source of truth for what we build. |
| `phases/` | Delivery plan. Each phase lists its specs and exit criteria. |
| `.specs/` | One folder per spec (`<name>_<version>/spec.md`). See `.specs/README.md`. |
| `docs/decisions.md` | Decisions, working defaults and open questions. |
| `infra/` | OpenTofu: `bootstrap` (state backend) and `living_repo` (workload). |
| `.draft/` | Original idea notes. Not authoritative. |

## How to work

1. Find the requirement in `features/` and its spec in the current phase. Do not build a feature without a spec.
2. If the spec is missing, create it from `.specs/_template/spec.md` and get it approved before writing code.
3. Implement against the acceptance criteria and reference requirement IDs in tests and PRs.
4. If the work changes a requirement or decision, update `features/` or `docs/decisions.md` in the same change.
5. If a task depends on an `Open` decision, stop and ask.
6. After each completed feature, commit using [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(sdk): add lifecycle events`.

## Shared tech stack

* Language: TypeScript
* Monorepo: Nx
* Bundler: Vite
* Unit and functional tests: Vitest
* Real-browser end-to-end tests: Playwright
* Schema validation:
  * Zod is the source of truth for internal structures.
  * JSON Schema for external files such as `gamingalo.json` is generated from Zod.
* Infrastructure: OpenTofu on AWS

## Component tech stack

| Component | Stack |
|---|---|
| SDK | TypeScript library, no framework dependency |
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
* Never commit credentials, state files or real `.tfvars` files.
