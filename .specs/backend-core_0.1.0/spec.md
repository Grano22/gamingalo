# Backend core

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** BE-001, XC-006
* **Depends on:** `repo-foundation_0.1.0`
* **Decisions:** D-05, D-23

## Problem

Every web service needs the same foundation: configuration, a database, migrations, errors, logging and health checks.

## Scope

### In scope for this increment

* `apps/api`, a Fastify service organized as vertical slices.
* `packages/contracts`, with Zod schemas shared by the API and its clients.
* PostgreSQL in production, and PGlite in development and tests.
* Migrations, health checks, structured logs and request IDs.

### Later increments

* Deployment and environments (needs `infra/`).
* Metrics, traces and service-level objectives.

## Behavior

| Route | Purpose |
|---|---|
| `GET /health` | The process is running. Doesn't touch the database. |
| `GET /ready` | Can serve traffic. Returns 503 if the database is unreachable. |
| `GET /v1/meta` | Service name, version and API version. |

Rules:

* Every error response is `{ error: { code, message, requestId } }`, using codes from `@gamingalo/errors`.
* Unexpected errors return `INTERNAL` and never expose details to the client. The details go to the logs.
* Each response has an `x-request-id`. Client-supplied IDs are ignored, so logs can't be forged.
* Configuration is validated at startup, and invalid configuration stops the process.
* Production requires `DATABASE_URL`, and never falls back to PGlite.
* Browser origins are denied unless listed in `CORS_ORIGINS`.
* Credentials and cookies are redacted from logs.
* Migrations run in order, each in a transaction, once only, under a lock. A failed migration leaves the database unchanged and stops startup.

## Acceptance criteria

* [x] AC-1: Health, readiness and meta responses match their contracts.
* [x] AC-2: `/ready` returns 503 with `SERVICE_UNAVAILABLE` when the database fails.
* [x] AC-3: Unknown routes, bad input and unexpected errors return the documented error shape, with no internal details.
* [x] AC-4: Invalid configuration is rejected, and production without `DATABASE_URL` is refused.
* [x] AC-5: Migrations apply once and in order, and a failure rolls back and stops.
* [x] AC-6: Listed origins get CORS headers, and other origins don't.
* [x] AC-7: Security headers are set, and client request IDs are ignored.
* [x] AC-8: The built service starts and answers requests, and stops cleanly on SIGTERM.

## Security and privacy

* The body size limit defaults to 1 MB.
* IP addresses aren't logged by default (D-18).

## Test plan

* Vitest with Fastify's `inject` and PGlite.
* A smoke test that runs the built service.
* The PostgreSQL adapter still needs testing against a real server, because Docker isn't available on the development machine. CI should provide one.

## Tasks

* [x] Contracts package
* [x] Service skeleton and slices
* [x] Database and migrations
* [ ] Test the PostgreSQL adapter against a real server
* [ ] Deployment

## Open questions

None.
