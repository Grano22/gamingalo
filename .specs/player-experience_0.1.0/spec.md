# Player experience

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P2
* **Requirements:** SDK-010, SDK-018, SDK-033, SDK-034, WEB-012, WRAP-006, XC-018
* **Depends on:** `sdk-initiation_0.0.1`, `sdk-hardening_0.1.0`
* **Decisions:** D-19, D-27

## Problem

A canvas is invisible to assistive technology, so canvas games are unusable with screen readers by default. This spec's first increment covers accessibility (SDK-018). The other requirements get their own increments.

## Scope

### In scope for this increment

* `sdk.accessibility`: player preferences, an ARIA mirror of game UI, live announcements, contrast filters and optional speech.
* An `accessibility` event when preferences change.
* Test helpers in `@gamingalo/sdk/testing`.

### Out of scope

* Building a screen reader. The SDK exposes content to the one the player already uses.
* Detecting whether a screen reader is running. Browsers don't expose this, on purpose.
* Making in-game play accessible automatically. The game decides what to expose.

## Behavior

```ts
sdk.accessibility.preferences();
// { reducedMotion, contrast, forcedColors, reducedTransparency }

sdk.accessibility.mirror([
  { id: 'title', role: 'heading', label: 'Main menu' },
  { id: 'start', role: 'button', label: 'Start game', onActivate: startGame, onFocus: highlightStart },
]);
sdk.accessibility.focus('start');
sdk.accessibility.announce('Level 2 reached');
sdk.accessibility.announce('Low health', { assertive: true });

sdk.accessibility.setCanvasFilter('high-contrast'); // needs realm.canvas
sdk.accessibility.speak('Level 2 reached');         // optional, returns false if unsupported
```

Rules:

* Mirror content is always set as text, never parsed as HTML.
* The mirror is visually hidden but stays reachable by keyboard and assistive technology. `onFocus` lets the game show its own focus highlight.
* Updating the mirror keeps focus on items whose `id` stays the same.
* An invalid mirror list throws `INVALID_ARGUMENT` and leaves the current mirror unchanged.
* Repeating an announcement announces it again.
* `setCanvasFilter` throws `INVALID_ARGUMENT` when no canvas is bound. Shutdown restores the canvas's original filter and removes the mirror.
* Filters are applied only when the game calls `setCanvasFilter`, because the player or game should choose them.
* Missing browser APIs give default preferences, and `speak` returns `false`.

## Acceptance criteria

* [x] AC-1: In Chromium, Firefox and WebKit, mirror items are exposed with the right roles and names, and keyboard activation calls `onActivate`.
* [x] AC-2: HTML in a label is shown as text and creates no elements.
* [x] AC-3: Focus stays on an item across a mirror update.
* [x] AC-4: Announcements appear in live regions with the right politeness, including repeats.
* [x] AC-5: Preferences follow emulated media settings, and changes emit `accessibility`.
* [x] AC-6: Contrast filters apply to the bound canvas, and shutdown restores it and removes everything the SDK added.
* [x] AC-7: Mock mode lets game makers check announcements, mirror items and activation, and set preferences.
* [x] AC-8: The bundle stays within budget.

## Security and privacy

* Preferences such as forced colors can contribute to fingerprinting. The SDK doesn't send them anywhere.
* Text is never parsed as HTML, so player names in a menu can't inject markup.

## Test plan

* Vitest with happy-dom and the mock for logic and validation.
* Playwright for AC-1 to AC-6, using the browsers' role-based queries.
* A manual pass with VoiceOver and NVDA, which automated tests can't replace.

## Tasks

* [x] Accessibility API and event
* [x] Mock helpers
* [ ] Manual screen reader pass
* [ ] Other requirements in this spec

## Open questions

None.
