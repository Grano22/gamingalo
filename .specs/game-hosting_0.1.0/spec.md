# Game hosting

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** BE-003, BE-004, BE-005, WEB-003, XC-002
* **Depends on:** `identity_0.1.0`
* **Decisions:** D-13, D-23

## Problem

Game makers need to publish games safely, and players need to play them without one game being able to reach another game, the platform or the player's account.

## Scope

### In scope

* A game registry with immutable versions, and production and preview channels.
* Uploads described by a signed manifest, with every file checked against it.
* Serving each game from its own origin, with strict security headers.
* A sandboxed game player on the web platform.
* API tokens for the CLI, and play tokens for games.

### Later increments

* Object storage and a CDN in place of the local file store (BE-005).
* Malware scanning beyond file type and path checks (BE-004).
* Removing files no version uses any more.
* Per-game allowances in the Content Security Policy, such as multiplayer servers.

## Behavior

* Games are served from `https://<game>.<games domain>/`, and previews from `https://preview--<game>.<games domain>/`. The games domain must be a separate site from the platform, and production refuses anything else. It should also be on the Public Suffix List, so that browsers treat each game as its own site. Until a domain is chosen, it's a placeholder setting (`GAMES_BASE_URL`).
* A creator needs a registered account. The CLI uses an API token created on the web platform, shown once and stored as a hash. Requests with a token ignore cookies.
* Each game has one or more Ed25519 signing keys. A version starts with a manifest listing every file's path, size and SHA-256 hash, signed with one of those keys.
* Files are uploaded by hash, and accepted only if their content matches. A file that's already stored, from any version, isn't uploaded again.
* A version becomes ready once every file is present, and never changes afterwards.
* Promoting a ready version to a channel makes it live. Promoting an older version rolls back.
* Allowed files: web pages, scripts, styles, WebAssembly, images, audio, video, fonts, models and data. Paths are relative, with no `..`, hidden files or executables.
* Game pages may only be embedded by the platform, may only contact themselves and the web services, and can't use plugins or submit forms.
* The platform embeds games in an `iframe` sandbox that allows scripts and the game's own storage. The game's separate origin is what keeps it away from the platform.
* A play token lasts 15 minutes and works for one game. With it, a game can read a limited profile: a player ID that differs for each game, the display name, whether the player is a minor, and whether they're a guest.

## Acceptance criteria

* [x] AC-1: A signed version can be uploaded, completed, made live and served from its game origin.
* [x] AC-2: Bad signatures, manifests changed after signing, and files that don't match are refused.
* [x] AC-3: Unsafe paths and file types, and oversized versions, are refused.
* [x] AC-4: Published versions never change. Preview and production are separate, and rollback works.
* [x] AC-5: Game responses carry the security headers above, and only live versions are served.
* [x] AC-6: API tokens are shown once, stored hashed, revocable, and need a registered account.
* [x] AC-7: Play tokens give each game a different player ID, expire, and only work from game origins.
* [ ] AC-8: A game published with the CLI plays inside the platform in Chromium, Firefox and WebKit, and can't read the platform's cookies or storage.

## Security and privacy

* Production refuses a games site that shares a site with the platform. Local development uses `*.games.localhost` beside `localhost`, which browsers treat as the same site, so cross-site protections between games and the platform are only fully tested once a real games domain exists.
* Games never receive session cookies or API tokens. The game API accepts play tokens only.

## Test plan

* Vitest with Fastify's `inject`, real Ed25519 keys and the games server.
* Playwright publishes a sample game with the CLI and plays it across browsers.

## Tasks

* [x] Registry, uploads and serving
* [ ] Game player and creator portal
* [ ] CLI publishing
* [ ] Object storage and CDN
* [ ] Malware scanning
* [ ] Unused file cleanup

## Open questions

* Which domain should games use? See `TODO.md`.
