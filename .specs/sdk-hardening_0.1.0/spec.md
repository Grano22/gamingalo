# SDK hardening

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** SDK-037, SDK-038, SDK-039
* **Depends on:** `sdk-initiation_0.0.1`
* **Decisions:** D-19, D-20, D-21, D-22

## Problem

The public SDK can be changed from outside. Page scripts can override its methods, pollute prototypes to change its behavior, and get its reference through `Gamingalo.instance()`. Mock mode can also be switched on in production.

## Scope

### In scope

* A public API that can't be changed, and has no prototype to change.
* Internal code that isn't affected by polluted prototypes or by built-ins patched after the SDK loads.
* A single reference per realm, optionally bound to specific origins, a frame type and a canvas.
* Mock mode that exists only in a separate test entry point.

### Out of scope

* Freezing the game page's own built-ins, which can break game libraries.
* Host page protections such as CSP and Subresource Integrity, covered by `game-hosting_0.1.0` (XC-002).
* Secured memory for game values (SDK-027).

## Behavior

```ts
const sdk = await Gamingalo.init({
  gameId: 'my-game',
  realm: {
    origins: ['https://my-game.example'], // exact match, optional
    frame: 'embedded',                    // 'top' | 'embedded' | 'any', default 'any'
    canvas,                               // must belong to this realm, optional
  },
});
sdk.realm;                                // { origin, embedded, canvas }

// Test code only:
import { createMockSdk } from '@gamingalo/sdk/testing';
const mocked = await createMockSdk({ connection: 'offline' });
mocked.mock.setConnection('online');
```

Rules:

* `Gamingalo`, the SDK reference, every feature API, their methods, errors and returned presets are frozen. The SDK reference and feature APIs have a `null` prototype.
* `init` gives out one reference per realm. While it is running, another `init` rejects with `SDK_ALREADY_INITIALIZED`, even with the same configuration. Only `shutdown` allows a new `init`. There is no way to look up the running reference.
* The SDK sets no globals.
* A realm that doesn't match its restrictions rejects with `REALM_NOT_ALLOWED`. This includes a canvas from another iframe.
* Configuration is read once, using own properties only.
* The production `init` rejects `mode` and `mock` as unknown options.
* `createMockSdk` rejects with `MOCK_NOT_ALLOWED` unless it runs in a test context: `NODE_ENV` is `test`, a Vitest or Jest environment is detected, or `navigator.webdriver` is `true`. `NODE_ENV=production` always refuses.
* Mock instances are independent and don't use the single reference.

## Limits

These limits are part of the contract, and must be stated in documentation for game makers:

* This protects against later scripts, not earlier ones. **The SDK must load first.** Code that runs before it can replace any built-in before the SDK captures it.
* A script can't take over an initialized SDK, but it can call `init` first. The game's own `init` then rejects, so games must treat that rejection as tampering.
* JavaScript can't identify the realm of a caller. If a game passes its reference to another frame, that frame can use it.
* Browser APIs such as IndexedDB and `localStorage` can't be protected. Same-origin code can read or change stored data directly, or patch those APIs. Anything that must be trustworthy is decided on a server.
* Debuggers and browser extensions can still inspect everything.
* The test-context check keeps mock mode out of real sessions by accident or misuse. It isn't a security boundary, and doesn't need to be: production builds don't contain mock code, and a mock instance has no access to anything real.

## Acceptance criteria

* [x] AC-1: Assigning, deleting or redefining members of `Gamingalo`, the reference and feature APIs fails in Chromium, Firefox and WebKit, and behavior doesn't change.
* [x] AC-2: Polluting `Object.prototype` can't enable mock mode, supply `gameId`, change settings, change save decoding or run a fake migration.
* [x] AC-3: Patching `Map`, `Set`, `Object.freeze`, `JSON` or `Reflect` after load doesn't expose values held by the facade, session memory or settings, and doesn't break them.
* [x] AC-4: While the SDK is running, no script can get its reference from the package.
* [x] AC-5: A wrong origin, wrong frame type or canvas from another iframe rejects with `REALM_NOT_ALLOWED`, and leaves the SDK free to start.
* [x] AC-6: The production entry point and everything it imports contain no mock code. The build fails if they do.
* [x] AC-7: `createMockSdk` works in Vitest and in Playwright, and rejects in a normal browser session and under `NODE_ENV=production`.
* [x] AC-8: The core bundle stays within budget.

## Design

* `src/primordials.ts` captures built-ins when the module loads, and provides `SafeMap`, `SafeSet` and `guardApi`.
* `src/facade.ts` builds a frozen reference from feature functions using closures, so there are no classes or prototypes to patch.
* `src/index.ts` is the production entry point, and `src/testing.ts` is the test entry point.
* Production configuration uses hand-written own-property checks, because Zod's parsers read inherited properties (D-22).

## Test plan

* Vitest for pollution, patched built-ins, configuration and test-context detection.
* Playwright for AC-1, AC-4, AC-5 and AC-7 in real browsers.
* The build script for AC-6 and AC-8.

## Tasks

* [x] Harden errors
* [x] Add primordials and rebuild the facade
* [x] Add realm binding
* [x] Move mock mode to the test entry point

## Open questions

None.
