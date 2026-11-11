# SDK platform bridge

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** SDK-002, SDK-011
* **Depends on:** `identity_0.1.0`, `game-hosting_0.1.0`
* **Decisions:** D-13, D-18, D-21

## Problem

A game on the platform needs to know who is playing, without ever getting the player's session or any way to act as them on the platform.

## Behavior

```ts
const sdk = await Gamingalo.init({ gameId: 'my-game', platform: { origin: 'https://play.example' } });
if (sdk.player.available()) {
  const { playerId, displayName, minor, guest } = await sdk.player.profile();
}
```

1. The SDK posts `gamingalo:ready` to the parent frame, addressed to the platform origin only.
2. The platform answers with a play token for this game, addressed to the game's origin only.
3. The SDK keeps the token in a closure, and calls `GET /v1/game/me` with it, sending no cookies or referrer.
4. Before a token expires, or after a 401, the SDK asks for a new one with `gamingalo:token-request`.

Rules:

* Messages are accepted only from the configured platform origin and the parent frame. Anything else is ignored.
* Token messages are checked field by field, using own properties. The API origin must be `http` or `https`.
* The token is never given to game code, plugins or events.
* `platform.origin` must be exactly an origin, with no path.
* Outside a frame, `available()` is `false` and `profile()` rejects with `FEATURE_UNAVAILABLE`. With no signed-in player, it rejects with `UNAUTHENTICATED` after 5 seconds.

## Acceptance criteria

* [ ] AC-1: Tokens from other origins, other windows or with bad fields are ignored.
* [ ] AC-2: The profile is read with the token, without cookies or referrer, and the token is refreshed after expiry or a 401.
* [ ] AC-3: Mock mode can simulate a player.
* [ ] AC-4: A game published with the CLI shows the player's name inside the platform in Chromium, Firefox and WebKit, and can't reach the platform page.

## Test plan

* Vitest with a simulated parent frame.
* Playwright with a real published game.

## Tasks

* [ ] Bridge and player API
* [ ] Platform side in the web player

## Open questions

None.
