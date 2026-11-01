# Web shell

* **Version:** 0.1.0
* **Status:** In progress
* **Phase:** P1
* **Requirements:** WEB-001, WEB-002, WEB-005, XC-007, XC-017
* **Depends on:** `backend-core_0.1.0`
* **Decisions:** D-02, D-23

## Problem

The platform needs an application foundation that later slices build on, connected to the real web services from the start.

## Scope

### In scope for this increment

* `apps/web`: an Angular application using Vertical Slice Architecture, with PrimeNG, Tailwind, Lucide and NgRx Signals.
* An accessible shell with navigation and a skip link.
* A service status slice that proves the connection to the API.
* Playwright tests across browsers, with automated accessibility checks.

### Later increments

* Game catalog and game pages (WEB-002).
* Creator portal (WEB-005).

## Behavior

* Slices live in `src/app/slices/<name>` and own their page, state and API calls. Slices don't import from each other.
* Routes are loaded on demand.
* API responses are validated against `@gamingalo/contracts`, so an unexpected response is treated as a failure.
* During development, `/api` is proxied to the web services.

## Acceptance criteria

* [x] AC-1: The application builds, and unit tests use Testing Library.
* [x] AC-2: The status page shows the real services in Chromium, Firefox and WebKit.
* [x] AC-3: A failed or malformed response shows `Unavailable`, and the page can recover.
* [x] AC-4: Navigation updates the URL, page title and `aria-current`.
* [x] AC-5: Pages have no automatically detectable WCAG 2.2 AA violations.

## Security and privacy

* The app stores nothing yet.
* A Content Security Policy for the deployed app comes with deployment.

## Test plan

* Vitest and Testing Library for components and state.
* Playwright and axe across browsers. Automated checks catch only some accessibility problems, so a manual audit is still required before Phase 1 ends.

## Tasks

* [x] Shell and status slice
* [ ] Game catalog and pages
* [ ] Creator portal
* [ ] Manual accessibility audit

## Open questions

None.
