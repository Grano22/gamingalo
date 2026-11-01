# SDK initiation

* **Version:** 0.0.1
* **Status:** Draft
* **Phase:** P1
* **Requirements:** SDK-001, SDK-009, XC-005
* **Depends on:** `repo-foundation_0.1.0`, `platform-contracts_0.1.0`
* **Decisions:** D-14

## Problem

Every SDK feature needs the same entry point, lifecycle and error handling. Building features first would give each one its own conventions, which would be hard to change once game makers depend on them.

## Scope

### In scope

* The `@gamingalo/sdk` package, built with Vite in library mode as ESM with type declarations.
* Initialization, shutdown and lifecycle events.
* Feature discovery, so games can check support before calling a feature.
* Shared error model and connection state.
* Mock mode for local development and tests, with no backend.

### Out of scope

* Feature APIs such as saves and profiles, which have their own specs.
* Auth bridge, covered by `identity_0.1.0`.
* Auto-update, covered by SDK-034 in Phase 2.

## Behavior

Draft of the public API, to be finalized during review:

```ts
const sdk = await Gamingalo.init({ gameId: 'my-game', mode: 'production' });

sdk.features.has('saves');           // boolean
sdk.connection.state;                // 'online' | 'offline' | 'degraded'
sdk.on('suspend', handler);          // tab hidden or page being frozen
sdk.on('resume', handler);

await sdk.shutdown();
```

Rules:

* `init` is safe to call repeatedly and returns the same instance for the same configuration. A different configuration rejects with `SDK_ALREADY_INITIALIZED`.
* `init` never fails only because the player is offline. The SDK starts in `offline` state.
* Calling any method before `init` or after `shutdown` throws `SDK_NOT_INITIALIZED`.
* Asynchronous failures reject with `GamingaloError`, which has a stable `code`, a `retryable` flag and a developer-facing `message`.

## Acceptance criteria

* [ ] AC-1: A plain JavaScript page can import the package, initialize it and shut it down with no runtime dependencies.
* [ ] AC-2: Repeated `init` calls follow the rules above.
* [ ] AC-3: Starting offline succeeds and reports `offline`. Connection changes emit an event.
* [ ] AC-4: `suspend` and `resume` fire in Chromium, Firefox and WebKit when the tab is hidden and shown.
* [ ] AC-5: Unavailable features report `false` from `features.has` and do not throw.
* [ ] AC-6: Error codes come from the shared package used by the backend and CLI (XC-005).
* [ ] AC-7: Mock mode runs with no network requests.
* [ ] AC-8: The core gzipped bundle stays within a size budget agreed during review and enforced in CI.

## Design

* Core with lazily loaded feature modules, so games only pay for the features they use.
* Lifecycle events are based on the Page Visibility and Page Lifecycle APIs where available.
* The configuration is validated with Zod.

## Security and privacy

* The core package does not collect personal data or start tracking on initialization.
* Treat all data from the host page and bridge as untrusted, and validate it at the boundary.
* The SDK never stores platform session tokens.

## Test plan

* Vitest for lifecycle, errors and configuration.
* Playwright for AC-1, AC-3 and AC-4 in Chromium, Firefox and WebKit.

## Tasks

* [ ] Create the package in the Nx workspace
* [ ] Add shared error codes
* [ ] Implement init, shutdown and lifecycle
* [ ] Implement feature discovery and connection state
* [ ] Implement mock mode
* [ ] Add browser tests and the bundle size check

## Open questions

* What is the core bundle size budget? Suggested starting point: 15 KB gzipped.
* Should the npm scope be `@gamingalo`? Check that it's available.
