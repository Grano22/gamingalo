# Plugin packages

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** SDK-043
* **Depends on:** `sdk-modules_0.1.0`, `versioning_0.1.0`
* **Decisions:** D-24, D-28, D-29

## Problem

Game makers and third parties need to extend the SDK by installing a package, without editing setup code for each one.

## Behavior

A plugin package declares itself in its `package.json`:

```json
{
  "gamingalo": { "formatVersion": 1, "sdk": ">=0.14.0 <1.0.0", "export": "gamingaloPlugin" }
}
```

Its main entry exports a function that takes options and returns a `GamingaloPlugin`. `export` defaults to `gamingaloPlugin`.

A game adds `@gamingalo/vite-plugin` to its Vite config, and starts the SDK with what it generates:

```ts
import { plugins } from 'virtual:gamingalo-plugins';
const sdk = await Gamingalo.init({ gameId: 'my-game', plugins });
```

Options come from `gamingalo.json`:

```json
{ "plugins": { "@gamingalo/plugin-screen-preferences": { "limits": { "brightness": { "min": 0.8, "max": 1.2 } } } } }
```

Rules:

* Only runtime `dependencies` count. Development dependencies don't ship with the game, so they're never plugins.
* Plugins are sorted by package name, so every build is the same.
* A plugin whose SDK range doesn't include the installed SDK fails the build, naming both versions.
* An invalid manifest, options for a package that isn't installed or isn't a plugin, and a missing install all fail the build with a clear message.
* `false` in `gamingalo.json` turns an installed plugin off.
* Options are embedded as JSON, so they can't inject code.
* In development, changing `package.json` or `gamingalo.json` reloads the game.
* Adding `plugins` made `gamingalo.json` format version 2 (D-28). Version 1 files migrate automatically.

## Acceptance criteria

* [x] AC-1: Installed plugins are found, sorted, and created with their options.
* [x] AC-2: Development dependencies are ignored, and `false` turns a plugin off.
* [x] AC-3: Incompatible SDK ranges, invalid manifests and wrong options fail with clear messages.
* [x] AC-4: A real Vite build bundles an installed plugin into the game.
* [x] AC-5: `@gamingalo/plugin-screen-preferences` is a plugin package.

## Test plan

* Vitest with packages written into a temporary `node_modules`, and a real Vite build.

## Tasks

* [x] Manifest schema and `gamingalo.json` version 2
* [x] `@gamingalo/vite-plugin`
* [x] ScreenPreferences manifest
* [ ] Discovery for other bundlers, if game makers need it

## Open questions

None.
