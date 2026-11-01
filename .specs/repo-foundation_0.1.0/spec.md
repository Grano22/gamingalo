# Repo foundation

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P0
* **Requirements:** XC-015, XC-020
* **Depends on:** none
* **Decisions:** none

## Problem

The repo has no workspace, so no package can be built or tested.

## Scope

### In scope

* Nx workspace using npm workspaces, with packages under `packages/`.
* Shared TypeScript, ESLint and Vitest setup.
* GitHub Actions CI that lints, type-checks, tests and builds.
* Infrastructure housekeeping (XC-020).

### Out of scope

* Angular, backend and CLI projects, which are added by their own specs.

## Acceptance criteria

* [ ] AC-1: `npm ci && npx nx run-many -t lint typecheck test build` passes from a clean checkout.
* [ ] AC-2: A second run with no changes reuses the Nx cache.
* [ ] AC-3: CI runs the same targets on pull requests and on `main`.
* [ ] AC-4: `infra/living_repo` is committed, and its README no longer refers to `../opentofu`. CI validates the OpenTofu roots.

## Test plan

Run AC-1 and AC-2 locally. AC-3 is verified on the first pushed pull request.

## Tasks

* [ ] Create the workspace and shared configuration
* [ ] Add CI
* [ ] Complete infrastructure housekeeping

## Open questions

None.
