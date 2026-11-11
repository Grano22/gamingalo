# TODO

Questions waiting for an answer from the project owner. See the rule in `AGENTS.md` for how to close them.

## Decisions

* [ ] **D-08:** Who pays for free cloud saves (200 MB per user in the draft), TURN relay traffic and moderation? Should Phase 1 enforce a smaller save quota until the cost model exists? Blocks the cloud part of `game-memory`.
* [x] ~~**D-10:** What should "Preferences AI" do? SDK-036 stays unscheduled until this is defined.~~ **Answer:** It's the Preferences API, not AI: support for custom game settings, apart from the developer settings.
* [ ] **D-15:** Which payment provider should handle tax, refunds and payouts? Needed before the Phase 2 `payments` spec is approved.

## SDK

* [ ] Is 15 KB gzipped the right size budget for the SDK core bundle?
* [x] ~~Should the npm scope be `@gamingalo`? It hasn't been checked or registered.~~ **Answer:** The owner controls the `gamingalo` npm organization, so packages are published as `@gamingalo/*`.
* [x] ~~Should mock mode stay? It was meant for working without a backend, which basic SDK use no longer needs (D-19). It still gives games test controls for connection, suspend and resume.~~ **Answer:** Yes, but only in a test context, so game designers can test features in unit tests. It must not be active in production. (D-20)
* [x] ~~Which foreign API should extended online features use first: the Gamingalo backend, or an adapter that lets game makers plug in their own?~~ **Answer:** Build the web platform and web services first and connect to them, but also support custom servers with different play modes, matchmaking and so on. A Server SDK for hosting is planned for later. (D-23)
* [x] ~~Did "coations API ... i18n" mean a Localization API? It's being built that way (D-25).~~ **Answer:** Yes, and it should also detect geolocation, the user's language, keyboard layout and so on.

## Hosting

* [ ] Which domain should games be served from? It must be separate from the platform's, and should be added to the Public Suffix List. The setting is a placeholder until then (D-13).

## Game skeleton

* [ ] What is the game skeleton's public git URL? `gamingalo create` uses `https://github.com/gamingalo/game-skeleton.git` as a placeholder until it's published (D-30).

## Release setup

These are one-time settings on GitHub and npm, which only the owner can change:

* [ ] Add an `NPM_TOKEN` secret (an npm automation token for the `gamingalo` organization) to a `release` environment in the repository settings. Or set up npm trusted publishing for each package, and the token isn't needed.
* [ ] In the repository's Pages settings, set the source to GitHub Actions.
* [ ] Which license should the published packages use? They have none, which means nobody may legally reuse them.

## Legal

* [ ] Can under 13s play as guests without parental consent, in each market we launch in? This is the current default (D-26).

## Manual checks

* [ ] Does switching tabs fire `suspend` and `resume` in real Chromium, Firefox and Safari? Automated tests can only simulate it (AC-4 in `sdk-initiation_0.0.1`).
* [ ] Do the SDK accessibility menus work with real VoiceOver and NVDA? Automated tests check roles and names, but can't replace a screen reader (`player-experience_0.1.0`).
