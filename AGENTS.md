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
| `apps/docs/` | The documentation site. |
| `tools/` | Repository scripts: plan, changelog and release checks. |
| `infra/` | OpenTofu: `bootstrap` (state backend) and `living_repo` (workload). |
| `.draft/` | Original idea notes. Not authoritative. |

## How to work

1. Find the requirement in `features/` and its spec in the current phase. Do not build a feature without a spec.
2. If the spec is missing, create it from `.specs/_template/spec.md` and get it approved before writing code.
3. Implement against the acceptance criteria and reference requirement IDs in tests and PRs.
4. If the work changes a requirement or decision, update `features/` or `docs/decisions.md` in the same change, and run `npm run check:plan`.
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

### Changelog rules (D-31)

* Every module, in `packages/` and `apps/`, has its own `CHANGELOG.md` and `changelogs/` folder.
* `CHANGELOG.md` holds **at most 12 versions**, newest first. Its newest version must match `package.json`, and every version needs notes.
* When adding a version would make 13, run `npm run changelog:rotate`. It moves every version except the newest to `changelogs/CHANGELOG.<oldest>.to.<newest>.md`, and `CHANGELOG.md` continues from the newest. Never edit an archive afterwards.
* Write notes for the module's users: what they can do now, what changed for them, and what breaks. Each version's section becomes its GitHub release notes.
* `npm run changelog:check` checks all of this, and runs in CI.

## Releases (D-32)

Each module is released on its own, from a tag named `<module>-v<version>`, such as `sdk-v0.14.0`. `<module>` is the folder name in `packages/` or `apps/`.

1. Bump the version and add the changelog section, as above, and commit.
2. Run `npm run release:tag -- <module>`. It checks the changelog and a clean working tree, then creates the tag.
3. Push the tag: `git push origin <module>-v<version>`. Only do this when the owner asks, because it publishes.

The **Release** workflow then checks the tag against `package.json`, builds and tests the module, publishes it to npm as `@gamingalo/<name>` with provenance, and creates a GitHub release with that version's changelog section. Versions with a prerelease part, such as `1.0.0-beta.1`, go to the `next` npm tag. CLI releases also attach standalone binaries for Linux, macOS and Windows (`npm run build:binary --workspace @gamingalo/cli` builds one locally). Private modules, such as `apps/api`, get a GitHub release and are never published to npm.

Published packages are `@gamingalo/errors`, `@gamingalo/contracts`, `@gamingalo/sdk`, `@gamingalo/plugin-screen-preferences`, `@gamingalo/vite-plugin` and `@gamingalo/cli`. The owner controls the `gamingalo` npm organization. A new published package needs `repository`, `homepage`, `publishConfig` and `files` like the others.

## Documentation (D-33)

`apps/docs` is the documentation site, built with Fumadocs and deployed to GitHub Pages on every push to `master`, the default branch.

* A change to public behavior updates the matching page in `apps/docs/content/docs/` in the same piece of work.
* Changelog pages are generated from each module's `CHANGELOG.md`. Don't edit them by hand.
* The site uses the Lit Grid design system in `apps/docs/components/ds/`. Use its tokens and components instead of new colors or one-off styles, with at most one lit element per view.
* Every page must pass WCAG 2.2 AA in light and dark mode. `npx nx run @gamingalo/docs:e2e` checks this.

## Game skeleton

The game skeleton is a separate repository, at `/Users/b/Documents/paid_projects/gamingalo-game-skeleton` during development, which `gamingalo create` clones (D-30). It must always show current SDK practice. When a change affects how games use the SDK, update the skeleton as part of the same piece of work:

1. Update the sample game if the change belongs in a typical game, and the `@gamingalo/*` versions in its `package.json`.
2. Update its skills in `.agents/skills/`, then run `npm run ai:sync` there.
3. Run its `npm run check` against local builds, using `node scripts/use-local-gamingalo.mjs <path to this repository>`.
4. Commit in the skeleton repository with a Conventional Commit message.

`TEMPLATE.md` in the skeleton has the full checklist.

## Format versions

Everything stored or exchanged has an integer format version, listed in `FORMAT_VERSIONS` in `@gamingalo/contracts` (D-28). A change that older readers can't handle bumps that version, and adds a migration step to the format's chain in the same commit. Steps must be deterministic, and must not change their input. Never change a format without its version.

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
| Web Platform | `apps/web`: Angular, Vertical Slice Architecture, Testing Library, PrimeNG, Tailwind, Lucide, NgRx Signals |
| Backend | `apps/api`: Fastify and PostgreSQL (D-05), organized as vertical slices. Development and tests use PGlite. API shapes live in `packages/contracts` |
| CLI | TypeScript, Node.js, commander |
| MCP Server | TypeScript, read-only by default |
| SDK plugins | Separate packages under `packages/plugin-*`, built on the public plugin API only. Each declares a `gamingalo` manifest in `package.json`, so `@gamingalo/vite-plugin` adds it when installed (D-29) |
| Server SDK | Planned (SRV-002). Custom servers use the documented protocol (SRV-001) |

## Rules that must not be broken

* The client is untrusted. Currency, entitlements, ranked results, scores and one-time actions are decided on the server.
* Describe client-side protection as raising the cost of an attack, never as a guarantee.
* Third-party games run on isolated origins and never receive platform session tokens.
* Never expose raw IP addresses or fingerprints to game code.
* Protection features must not block assistive technology.
* The SDK's public surface stays frozen, with no prototype and no globals. There is one reference per realm, with no way to look it up. Facade and feature code must not read inherited properties, and uses `src/primordials.ts` instead of global built-ins for anything that touches SDK state.
* Mock code lives only behind `@gamingalo/sdk/testing`, and must never reach the production entry point.
* Never commit credentials, state files or real `.tfvars` files.
