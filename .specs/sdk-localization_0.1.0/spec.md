# SDK localization

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** SDK-019
* **Depends on:** `sdk-hardening_0.1.0`
* **Decisions:** D-19, D-25, D-27

## Problem

Games need to speak the player's language and adapt to their region and keyboard, and each browser exposes this differently.

## Scope

### In scope

* Messages, with parameters, plurals and fallback.
* Choosing a locale, which persists, and following the browser's languages by default.
* Text direction, number and date formatting.
* Detecting language, region, time zone and keyboard layout, with no prompt.
* Geolocation, only when a game asks and the player allows it.

### Out of scope

* Loading translation files. Games load them and pass them to `addMessages`, or a plugin can.
* Region from an IP address, which needs a server (D-23).

## Behavior

```ts
const { localization } = sdk;

localization.addMessages('en', {
  greeting: 'Hello {name}',
  'coins.one': '{count} coin',
  'coins.other': '{count} coins',
});
localization.t('greeting', { name: 'Ada' });  // 'Hello Ada'
localization.t('coins', { count: 2 });        // '2 coins'
localization.setLocale('pl');
localization.direction();                     // 'ltr' | 'rtl'
localization.formatNumber(1234.5);
localization.formatDate(new Date());

await localization.detect();
// { language, languages, region, timeZone, direction, keyboard: { layout, keys } }

await localization.requestGeolocation();
// { status: 'granted', latitude, longitude, accuracyMeters }
// or { status: 'denied' | 'unavailable' | 'timeout' }
```

Rules:

* Lookup order: the chosen locale or else each browser language, then each one's base language (`pt-BR`, then `pt`), then the fallback locale, which defaults to `en`. A missing message returns its key.
* Plural forms use the `count` parameter and the language's rules, with `.other` as a fallback.
* Parameters are own properties only. An unknown `{placeholder}` stays as written. Message values are plain text.
* An invalid locale tag throws `INVALID_ARGUMENT`.
* `region` comes from the locale tag, and is `unknown` when the tag has none. It describes the player's language settings, not where they are.
* `keyboard.layout` is `qwerty`, `qwertz`, `azerty`, `dvorak`, `colemak`, `other` or `unknown`. Only Chromium exposes it, on secure origins. `keys` maps physical key codes to labels where known, so a game can show "Press Z" on the right key.
* `detect` shows no prompts. Only `requestGeolocation` can, so games should call it in response to a player's action.
* The SDK doesn't store or send geolocation, and `requestGeolocation` never rejects for a refusal or missing support.

## Acceptance criteria

* [x] AC-1: Messages, parameters, plurals, fallback and missing keys follow the rules.
* [x] AC-2: The chosen locale persists across a reload, and changes emit `locale`.
* [x] AC-3: Direction and formatting follow the locale, including right-to-left languages.
* [x] AC-4: `detect` works with no prompts in Chromium, Firefox and WebKit, with `unknown` where unavailable.
* [x] AC-5: Known keyboard maps are classified correctly.
* [x] AC-6: Geolocation reports granted, denied, unavailable and timeout correctly, and nothing asks for it until a game calls it.
* [x] AC-7: Polluted prototypes can't supply messages or parameters.
* [x] AC-8: Mock mode has configurable languages, keyboard and geolocation.
* [x] AC-9: The bundle stays within budget.

## Security and privacy

* Precise location is sensitive personal data. It stays in the game unless the game chooses to send it, in which case the game maker is responsible for consent.
* Language, time zone and keyboard layout can contribute to fingerprinting. The SDK doesn't send them anywhere.
* Messages are plain text. Games must not insert translated text as HTML.

## Test plan

* Vitest with a stubbed source for logic.
* Playwright for persistence, detection and geolocation in real browsers.

## Tasks

* [x] Localization API

## Open questions

None.
