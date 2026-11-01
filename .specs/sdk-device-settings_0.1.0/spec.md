# SDK environment and settings

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** SDK-007, SDK-008
* **Depends on:** `sdk-initiation_0.0.1`
* **Decisions:** none

## Problem

Games need to adapt to very different devices, but browsers expose this information unevenly. Games also need somewhere to keep player settings, and a simple way to choose graphics quality.

## Scope

### In scope

* `sdk.environment`: browser, platform, hardware, graphics, display and device information, plus a capability tier.
* `sdk.settings`: persistent custom settings and graphics presets.
* A `devices` event when a gamepad or media device is added or removed.

### Out of scope

* Changing the game's renderer. The SDK only recommends values, and the game applies them.
* Input handling (SDK-010) and "Preferences AI" (SDK-036, D-10).
* Syncing settings between devices or tabs.

## Behavior

```ts
const env = await sdk.environment.read();
env.browser.name;        // 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown'
env.hardware.cpuCores;   // number | 'unknown'
env.graphics.webgpu;     // boolean
env.tier;                // 'low' | 'medium' | 'high' | 'unknown'

sdk.settings.set('musicVolume', 0.5);
sdk.settings.get('musicVolume', 1);   // 0.5

await sdk.settings.setGraphicsPreset('auto');
const graphics = await sdk.settings.getGraphics(); // recommended values
sdk.on('graphics', (values) => applyToRenderer(values));
```

Rules:

* A value the browser doesn't expose is `'unknown'`. It is never guessed, and reading never fails because an API is missing.
* The tier is `unknown` when both CPU cores and memory are unknown. Otherwise:
  * `low`: known cores or memory below 4, or neither WebGPU nor WebGL2.
  * `high`: WebGPU, at least 8 cores, and memory unknown or at least 8 GB.
  * `medium`: everything else.
* Reading the environment asks for no permissions and shows no prompts.
* Settings are JSON values, stored per game. Other values throw `INVALID_ARGUMENT`.
* If storage is blocked or full, settings stay in memory for the session, and `sdk.settings.persistent` is `false`. Corrupted stored settings are treated as empty.
* The graphics preset defaults to `auto`, which follows the tier. An `unknown` tier uses `medium`.
* Mock mode returns a fixed environment that can be overridden, and never touches browser storage.

## Acceptance criteria

* [x] AC-1: `environment.read()` returns a complete result in Chromium, Firefox and WebKit with no permission prompts.
* [x] AC-2: Unavailable APIs produce `'unknown'` or `false` without throwing.
* [x] AC-3: The tier follows the rules above.
* [x] AC-4: Settings survive a page reload in Chromium, Firefox and WebKit, and are separate for each game.
* [x] AC-5: Blocked storage, full storage and corrupted data don't throw from `get` or `set`, and `persistent` reports `false` when a write fails.
* [x] AC-6: Setting a preset persists it and emits `graphics` with the resolved values.
* [x] AC-7: Mock mode results are deterministic, and overrides apply.

## Design

* Browser information comes from standard APIs, using `navigator.userAgentData` when available and the user agent string otherwise.
* WebGPU support is checked with `navigator.gpu.requestAdapter()`, and a missing adapter counts as unsupported.
* Settings use `localStorage`, because they are small and games need to read them synchronously at startup.

## Security and privacy

* This data can contribute to fingerprinting. The SDK doesn't send it anywhere, and only reports device counts, never device names or IDs.
* Reported adapter details are limited to the coarse vendor and architecture that browsers already expose.

## Test plan

* Vitest with stubbed browser APIs for AC-2, AC-3, AC-5, AC-6 and AC-7.
* Playwright for AC-1 and AC-4.

## Tasks

* [x] Environment API and `devices` event
* [x] Settings API and graphics presets

## Open questions

None.
