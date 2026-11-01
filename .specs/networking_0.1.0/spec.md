# Networking

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P3
* **Requirements:** BE-016, SDK-020, SDK-023
* **Depends on:** `sdk-initiation_0.0.1`, `sdk-hardening_0.1.0`
* **Decisions:** D-19

## Problem

Multiplayer games need to know how good a player's connection is, in a way that works across browsers and doesn't expose personal data. This spec's first increment covers the local part of the Network API (SDK-023). Peer-to-peer play and relays come later.

## Scope

### In scope for this increment

* `sdk.network.sessionId`: a random ID for this game session.
* `sdk.network.info()`: what the browser reports about the connection.
* `sdk.network.measure()`: ping, jitter, packet-style loss and optional throughput against a URL the game chooses.

### Out of scope

* MAC addresses, which browsers don't expose, and raw IP addresses, which are never given to games.
* Coarse region, which needs a server (a later increment).
* Peer-to-peer connection stats, which come with SDK-020.

## Behavior

```ts
sdk.network.sessionId;      // random, new for each SDK start
sdk.network.info();         // { online, effectiveType, downlinkMbps, rttMs, saveData }

await sdk.network.measure({ samples: 5 });
// { pingMs, jitterMs, lossPercent, samples, throughputMbps }

await sdk.network.measure({
  url: 'https://my-game.example/ping',
  throughputUrl: 'https://my-game.example/1mb.bin',
});
```

Rules:

* The SDK makes no network requests unless the game calls `measure`.
* `url` defaults to the current page's address. Other URLs must be `http` or `https`, and need CORS to be readable by the browser.
* Requests bypass the cache, send no credentials and no referrer.
* `samples` is between 1 and 20, and defaults to 5. Each request times out after 5 seconds by default.
* `pingMs` is the median, so that one slow request doesn't distort it. `jitterMs` is the mean difference between consecutive samples.
* A failed request counts toward `lossPercent`. `measure` doesn't reject for network failures: if every sample fails, values are `unknown` and `lossPercent` is 100.
* This loss figure is HTTP request failures, not packet loss, and is only a rough signal.
* Values the browser doesn't report are `unknown`. Only Chromium reports most of `info()`.

## Acceptance criteria

* [x] AC-1: `measure` reports plausible values against a local server in Chromium, Firefox and WebKit.
* [x] AC-2: Going offline gives 100% loss with no rejection.
* [x] AC-3: Invalid URLs and sample counts reject with `INVALID_ARGUMENT`.
* [x] AC-4: Calculations for median, jitter, loss and throughput are correct.
* [x] AC-5: No network request happens until `measure` is called.
* [x] AC-6: Requests omit credentials and referrer, and bypass the cache.
* [x] AC-7: Mock mode returns configured values with no network requests.
* [x] AC-8: No result contains an IP address or MAC address.

## Security and privacy

* The session ID is random, and isn't derived from the device.
* A game could use `measure` to contact any CORS-enabled URL, but it can already do that with `fetch`. The SDK adds no new capability, and doesn't send data of its own.

## Test plan

* Vitest with a stubbed `fetch` for calculations and validation.
* Playwright against the local test server.

## Tasks

* [x] Local Network API
* [ ] Coarse region through a foreign API
* [ ] Peer-to-peer stats
* [ ] Signaling and TURN relay

## Open questions

None.
