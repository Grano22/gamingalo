# CLI publishing

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** CLI-001, CLI-002, CLI-003, CLI-004, CLI-005, CLI-006, CLI-008
* **Depends on:** `game-hosting_0.1.0`
* **Decisions:** D-01, D-03, D-04, D-28

## Problem

Game makers need to publish from their machine or from CI with one command, without handling signing and uploads themselves.

## Scope

### In scope

* `@gamingalo/cli` with commander, published as the `gamingalo` command.
* Signing in with an API token, by file or environment variables for CI.
* Creating a game and a signing key, validating, publishing, listing versions, promoting and rolling back.
* Static budgets from `gamingalo.json` (CLI-008).

### Later increments

* A local backend emulator (CLI-006). Games can already use `@gamingalo/sdk/testing` for a mock SDK.

## Behavior

```sh
echo "$TOKEN" | gamingalo login --token-stdin --api-url https://api.example
gamingalo game:create
gamingalo game:keys:create
gamingalo game:validate
gamingalo game:publish --channel preview
gamingalo game:versions
gamingalo game:promote 1.1.0
gamingalo game:rollback 1.0.0
```

Rules:

* `GAMINGALO_TOKEN` and `GAMINGALO_API_URL` override the saved credentials, and `GAMINGALO_SIGNING_KEY` with `GAMINGALO_SIGNING_KEY_ID` override the saved signing key, so CI needs no files.
* Credentials and private keys are stored in files only the user can read. `--token` warns that it can end up in shell history, so `--token-stdin` is preferred.
* Publishing validates first, checks the service supports this CLI's manifest format, signs the manifest, uploads only missing files, completes the version and makes it live.
* Hidden files are skipped with a warning. Symbolic links, unsafe paths, disallowed file types, a missing entry file and exceeded budgets stop publishing, with every problem listed.
* `gamingalo.json` is migrated from older format versions before it's validated (D-28).

## Acceptance criteria

* [x] AC-1: Login stores a private credentials file, and refuses a bad token without saving it.
* [x] AC-2: Publish signs, uploads only missing files, and makes the version live on the chosen channel.
* [x] AC-3: Versions can be listed, promoted and rolled back.
* [x] AC-4: Problems and exceeded budgets are reported before anything is uploaded.
* [x] AC-5: Private keys and credentials are readable only by the user.

## Test plan

* Vitest runs the CLI's commands against the real API on a local port.

## Tasks

* [x] Commands
* [ ] Local backend emulator

## Open questions

None.
