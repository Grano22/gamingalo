# SDK modules

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** SDK-036, SDK-040, PLG-001
* **Depends on:** `sdk-hardening_0.1.0`, `sdk-device-settings_0.1.0`
* **Decisions:** D-10, D-19, D-21, D-24

## Problem

Games need player-facing settings that are separate from developer-level controls. Game makers also want optional features, such as brightness controls, without every game paying for them in the core bundle.

## Scope

### In scope

* `sdk.preferences`: custom game settings, defined by the game and chosen by the player.
* `sdk.settings`: developer-level graphics controls only. Custom values move to `sdk.preferences`.
* A plugin system, with a public API for writing plugins.
* `@gamingalo/plugin-screen-preferences`, the first official plugin.

### Out of scope

* Syncing preferences between devices, which belongs to the Data Sync API.
* Downloading plugins at runtime. Plugins are ordinary packages the game bundles.

## Behavior

```ts
sdk.preferences.define({
  volume: { type: 'number', default: 0.8, min: 0, max: 1 },
  difficulty: { type: 'string', default: 'normal', options: ['easy', 'normal', 'hard'] },
  subtitles: { type: 'boolean', default: true },
});
sdk.preferences.get('volume');        // 0.8
sdk.preferences.set('volume', 0.5);
sdk.preferences.reset('volume');
sdk.on('preferences', ({ key, value }) => {});

const screen = screenPreferences();
const sdk = await Gamingalo.init({ gameId: 'my-game', realm: { canvas }, plugins: [screen] });
sdk.use(screen).setBrightness(1.2);
```

Preference rules:

* A value that doesn't fit its definition throws `INVALID_ARGUMENT`.
* A stored value that no longer fits its definition is ignored, and the default is used.
* Keys without a definition accept any JSON value.
* Blocked or full storage keeps values in memory, and `persistent` reports `false`.

Plugin rules:

* A plugin is an object with its own `name` and `setup(context)` properties, and `setup` returns the plugin's API. Plugins are ordinary objects, so a plugin package needs only the SDK's types at runtime.
* `sdk.use(plugin)` returns that API, frozen and guarded like any other SDK API. It stops working on shutdown.
* Plugins receive only the context, never the facade's internal controls.
* A plugin's preferences are stored separately from the game's and from other plugins'.
* Plugins layer their canvas filters, so they don't overwrite each other or accessibility filters.
* Duplicate names reject with `INVALID_CONFIG`. A failing `setup` rejects `init` with `PLUGIN_FAILED`, undoes what already ran, and leaves the SDK free to start again.
* Plugins run with the same access as the game, because they're code the game chose to include. They're not a security boundary.

ScreenPreferences rules:

* Brightness, contrast, saturation and gamma are numbers within limits the game can narrow. Defaults leave the picture unchanged.
* Values persist between sessions, and apply to the bound canvas at startup.
* Without a bound canvas, values are stored, and nothing is applied until one exists.
* Gamma uses an inline SVG filter, because CSS has no gamma function. If that isn't available, the other settings still work.

## Acceptance criteria

* [x] AC-1: Definitions validate values, reject bad definitions, and ignore stored values that no longer fit.
* [x] AC-2: `sdk.settings` holds graphics only, and `sdk.preferences` holds custom values.
* [x] AC-3: Preferences survive a reload in Chromium, Firefox and WebKit, and changes emit `preferences`.
* [x] AC-4: `sdk.use` returns a frozen, guarded API, and an unregistered plugin throws `FEATURE_UNAVAILABLE`.
* [x] AC-5: A failing plugin rejects `init`, runs cleanups, and leaves the SDK free to start.
* [x] AC-6: Plugin storage is isolated, and plugin cleanups run on shutdown.
* [x] AC-7: Plugin filters and accessibility filters combine without overwriting each other.
* [x] AC-8: ScreenPreferences changes the rendered canvas in Chromium, Firefox and WebKit, and persists.
* [x] AC-9: Plugins aren't included in the core bundle, and work with `createMockSdk`.

## Security and privacy

* Plugin values and definitions are read with own-property checks, like all other SDK input.

## Test plan

* Vitest for logic, and Playwright for rendering and persistence in real browsers.

## Tasks

* [x] Preferences API
* [x] Plugin system and filter layers
* [x] ScreenPreferences plugin

## Open questions

None.
