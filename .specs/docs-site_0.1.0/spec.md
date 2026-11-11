# Documentation site

* **Version:** 0.1.0
* **Status:** Done
* **Phase:** P1
* **Requirements:** XC-024
* **Depends on:** `release-pipeline_0.1.0`
* **Decisions:** D-33

## Behavior

* `apps/docs` uses Next.js 16 and Fumadocs, following its manual installation, as a static export with search that runs in the browser.
* Lit Grid, the design system, is in `components/ds/`: color, type and shape tokens, and `Badge`, `Kbd`, `Tile`, `TileGrid`, `Swatch` and `TileLogo`. Its own page documents it.
* Changelog pages are generated from each module's `CHANGELOG.md` at build time.
* `.github/workflows/docs.yml` builds it with the repository name as base path, and deploys it to GitHub Pages on every push to `main`.

## Acceptance criteria

* [x] AC-1: The site builds as a static export, and works under the Pages base path.
* [x] AC-2: Navigation, search, changelog pages and the not-found page work in Chromium, Firefox and WebKit.
* [x] AC-3: Every tested page passes automated WCAG 2.2 AA checks in light and dark mode, including code blocks.
* [x] AC-4: The logo's motion stops under reduced motion.

## Not verified

* The Pages deployment hasn't run, because nothing is pushed, and Pages needs the setting in `TODO.md`.
