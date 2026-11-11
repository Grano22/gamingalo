# Game skeleton

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** CLI-012, XC-022
* **Depends on:** `plugin-packages_0.1.0`, `cli-publish_0.1.0`
* **Decisions:** D-29, D-30

## Problem

Game makers, and the AI agents they work with, need a starting point that already uses the SDK correctly, so that good practice is the default.

## Scope

The skeleton is its own repository, at `/Users/b/Documents/paid_projects/gamingalo-game-skeleton` during development (D-30). It contains:

* A small game on the SDK: pure rules, saves with a versioned format, preferences, two languages, an accessible mirror of the controls, the player profile and an installed plugin, all tested with the mock SDK.
* Vite with `@gamingalo/vite-plugin`, TypeScript, Vitest, budgets in `gamingalo.json`, and npm scripts from `dev` to `publish:production`.
* Shared AI instructions in `AGENTS.md`, with `CLAUDE.md` importing it.
* Skills in `.agents/skills/`: SDK use, saves and migrations, plugins, publishing, testing and memory. Codex, OpenCode and pi read them directly. Claude Code reads a copy in `.claude/skills/`, which `npm run ai:check` keeps in sync.
* Tool configuration for Claude Code (`.claude/`, `.mcp.json`), OpenAI Codex (`.codex/config.toml`), OpenCode (`opencode.json`) and pi (`.pi/`). It contains no credentials, and setting up providers is documented in `docs/ai.md`.
* A basic-memory knowledge graph in `docs/memory/`, served to every tool over MCP.
* A lookup order for agents: project memory, then skills, then the installed SDK's types and changelog, then the web.

`gamingalo create <directory>` clones it with git, replaces the placeholder ID and title listed in `.gamingalo/template.json`, removes the template's own files, and starts a fresh git repository.

## Acceptance criteria

* [x] AC-1: The skeleton passes `npm run check` with local builds of the packages: types, tests, skill sync, build and `gamingalo game:validate`.
* [x] AC-2: The built game starts in Chromium under the games server's Content Security Policy, with no errors, and its controls are reachable through the accessibility mirror.
* [x] AC-3: The installed plugin and its options from `gamingalo.json` are in the build.
* [x] AC-4: `opencode.json` and `gamingalo.json` validate against their real schemas, and `.codex/config.toml` and every JSON config parse.
* [x] AC-5: A game created with `gamingalo create` has no placeholders or template files left, and passes `npm run check`.

## Tasks

* [x] Sample game and tooling
* [x] AI configuration, skills and memory
* [x] `gamingalo create`
* [ ] Publish the skeleton at its public git URL (see `TODO.md`)

## Open questions

* What is the skeleton's public git URL? The CLI's default is a placeholder.
