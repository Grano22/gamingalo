# SDK initiation

* **Version:** 0.0.1
* **Status:** In progress
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

Public API:

```ts
const sdk = await Gamingalo.init({ gameId: 'my-game' });

sdk.features.has('saves');           // boolean
sdk.connection.state;                // 'online' | 'offline' | 'degraded'
const off = sdk.on('suspend', handler); // tab hidden or page being frozen
sdk.on('resume', handler);
sdk.on('connection', (state) => {});

await sdk.shutdown();

// Mock mode, for tests only (see sdk-hardening_0.1.0).
import { createMockSdk } from '@gamingalo/sdk/testing';
const mocked = await createMockSdk({ connection: 'offline', features: ['saves'] });
mocked.mock.setConnection('online');
mocked.mock.suspend();
mocked.mock.resume();
```

Rules:

* `init` gives out one reference per realm. Calling it again while the SDK is running rejects with `SDK_ALREADY_INITIALIZED` (changed by `sdk-hardening_0.1.0`).
* An invalid configuration rejects with `INVALID_CONFIG` and leaves nothing running.
* `init` never fails only because the player is offline. The SDK starts in `offline` state.
* After `shutdown`, every member of the reference throws `SDK_NOT_INITIALIZED`, except `shutdown`, which is safe to repeat.
* Failures use `GamingaloError`, which has a stable `code`, a `retryable` flag and a developer-facing `message`.
* A game's event handler that throws is logged and doesn't affect other handlers.
* A game started in a hidden tab receives `resume` when first shown, with no `suspend` before it.
* `degraded` is reserved. Only later transports can detect it, so production mode currently reports `online` or `offline`. Mock mode can set any state.
* `features.has` reports nothing as available in production until feature specs ship.

## Acceptance criteria

* [x] AC-1: A plain JavaScript page can import the package, initialize it and shut it down with no runtime dependencies.
* [x] AC-2: Repeated `init` calls follow the rules above.
* [x] AC-3: Starting offline succeeds and reports `offline`. Connection changes emit an event.
* [ ] AC-4: `suspend` and `resume` fire in Chromium, Firefox and WebKit when the tab is hidden and shown. Automated tests pass in all three using a simulated visibility value, because headless browsers don't hide pages. A manual check with real tab switching is still needed.
* [x] AC-5: Unavailable features report `false` from `features.has` and do not throw.
* [x] AC-6: Error codes come from the shared package intended for the backend and CLI (XC-005).
* [x] AC-7: Mock mode runs with no network requests.
* [x] AC-8: The core gzipped bundle stays within the size budget of 15 KB, enforced by the build.

## Design

* The SDK is a plain library (D-19). Plain feature functions live in `src/features/*`, and `src/facade.ts` exposes them as methods.
* Lifecycle events are based on the Page Visibility and Page Lifecycle APIs where available.
* The configuration is validated with own-property checks (D-22). `@gamingalo/errors` is bundled, so the package has no runtime dependencies.

## Security and privacy

* The core package does not collect personal data or start tracking on initialization.
* Treat all data from the host page and bridge as untrusted, and validate it at the boundary.
* The SDK never stores platform session tokens.

## Test plan

* Vitest for lifecycle, errors and configuration.
* Playwright for AC-1, AC-3 and AC-4 in Chromium, Firefox and WebKit.

## Tasks

* [x] Create the package in the Nx workspace
* [x] Add shared error codes
* [x] Implement init, shutdown and lifecycle
* [x] Implement feature discovery and connection state
* [x] Implement mock mode
* [x] Add browser tests and the bundle size check
* [ ] Check real tab switching manually in Chromium, Firefox and Safari (AC-4)

## Open questions

* Confirm the 15 KB budget. The production bundle is currently about 8 KB.
* Should the npm scope be `@gamingalo`? Registering it hasn't been checked or done.
