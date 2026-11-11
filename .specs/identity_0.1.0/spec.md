# Identity

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** BE-002, SDK-002, SDK-011, WEB-004, XC-008, XC-009, XC-010
* **Depends on:** `backend-core_0.1.0`, `web-shell_0.1.0`
* **Decisions:** D-18, D-23, D-26

## Problem

Players need to start playing straight away, keep their progress, and stay in control of their data. The platform needs to know a player's age band to apply the right protections.

## Scope

### In scope for this increment

* Guest accounts, started with an age question.
* Passkey sign-in, which also upgrades a guest to a registered account.
* Sessions in secure cookies, and signing out.
* Display names, consents, data export and account deletion.
* The web pages for all of these.

### Later increments

* OAuth sign-in and account linking (BE-002).
* Scoped game tokens and the SDK auth bridge (SDK-002), which need game hosting.
* Profiles in the SDK (SDK-011).
* Removing abandoned guest accounts.

## Behavior

| Route | Purpose |
|---|---|
| `POST /v1/accounts/guest` | Creates a guest account and session from an age band |
| `GET /v1/me` | The signed-in account |
| `PATCH /v1/me` | Changes the display name |
| `GET`, `PUT /v1/me/consents` | Optional consents |
| `GET /v1/me/export` | All data held about the account, as a download |
| `DELETE /v1/me` | Deletes the account and everything linked to it |
| `POST /v1/passkeys/registration/options`, `/verify` | Adds a passkey to the signed-in account |
| `POST /v1/passkeys/login/options`, `/verify` | Signs in with a passkey |
| `DELETE /v1/sessions/current` | Signs out |

Rules:

* The session is an opaque random token in an `HttpOnly`, `SameSite=Lax` cookie, which is `Secure` and `__Host-` prefixed in production. Only its SHA-256 hash is stored.
* Sessions last 30 days, and are extended on use once half of that has passed. Signing out deletes the session on the server.
* Changes such as `POST`, `PATCH`, `PUT` and `DELETE` need an `Origin` header that matches the web platform. Cross-site requests are refused with `FORBIDDEN`.
* Sign-in routes are rate-limited, and over-limit requests get `RATE_LIMITED`.
* Only an age band is stored, never a birth date: `under13`, `13to15` or `16plus`. Anyone under 16 is a minor.
* Under 13s can play as guests. They can't add a passkey or turn on optional consents until parental consent exists (XC-011), and get `PARENTAL_CONSENT_REQUIRED` if they try.
* Optional consents are off by default. Only essential cookies are used, so no cookie banner is needed yet.
* Passkey challenges are single use and expire after 5 minutes. Any verification failure returns the same `UNAUTHENTICATED` error, so it reveals nothing about why.
* Deleting a registered account needs a passkey sign-in in the last 15 minutes, or it gets `REAUTHENTICATION_REQUIRED`. Deletion is immediate and complete.
* Exports never include session tokens or passkey public keys.
* Signing in with a passkey while a guest replaces the guest session. The web platform warns that guest progress stays on the old guest account.

## Acceptance criteria

* [x] AC-1: A guest can start playing, rename themselves and sign out, in Chromium, Firefox and WebKit.
* [x] AC-2: A passkey upgrades a guest, and signs the same account back in after signing out (Chromium virtual authenticator).
* [x] AC-3: Session cookies are `HttpOnly` and unreadable from scripts, tokens are stored only as hashes, and signed-out or expired sessions stop working.
* [x] AC-4: Cross-site and origin-less changes are refused, and sign-in routes are rate-limited.
* [x] AC-5: Under 13s can't add a passkey or turn on optional consents.
* [x] AC-6: Export downloads everything held about the account, with no secrets.
* [x] AC-7: Deletion removes every related row, and needs a recent sign-in for registered accounts.
* [x] AC-8: Bad, replayed, expired and mismatched passkey challenges are all refused.
* [x] AC-9: The new pages have no automatically detectable WCAG 2.2 AA violations.

## Security and privacy

* No IP addresses are stored. Rate limiting holds them in memory only (D-18).
* Production refuses insecure cookies, a non-`https` web origin, or a passkey RP ID that doesn't match the web origin.

## Test plan

* Vitest with Fastify's `inject` and PGlite for every route and rule.
* Playwright across browsers for the web flows. Passkey flows run in Chromium only, because only it has a virtual authenticator.

## Tasks

* [x] Accounts, sessions and passkeys in the API
* [x] Web pages
* [ ] OAuth
* [ ] Game tokens and SDK auth bridge
* [ ] Guest account cleanup
* [ ] Legal review of age handling

## Open questions

* Is playing as a guest acceptable for under 13s without parental consent, in each market? See `TODO.md`.
