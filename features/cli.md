# CLI requirements

TypeScript and Node.js binary for game makers.

| ID | Requirement | Origin | Phase |
|---|---|---|---|
| CLI-001 | CLI foundation with interactive login and CI tokens | Proposed | P1 |
| CLI-002 | `gamingalo.json` schema and a `game:validate` command | Changed | P1 |
| CLI-003 | One-command publishing with `gamingalo game:publish` | Original | P1 |
| CLI-004 | Game signing before upload | Original | P1 |
| CLI-005 | Release channels, preview links and rollback | Proposed | P1 |
| CLI-006 | Local backend emulator and mock SDK | Proposed | P1 |
| CLI-007 | Devtools for debugging the SDK | Original | P2 |
| CLI-008 | Static budgets in `gamingalo.json`: bundle size, per-asset size, total download and asset counts. Checked by `game:validate` and `game:publish` | Original | P1 |
| CLI-009 | Securing the game before upload: asset encryption, watermark setup and optional code obfuscation | Changed | P4 |
| CLI-011 | `gamingalo migrate`: moves a project and its data from one supported version to another, using the deterministic migration steps (XC-021) | Original | P2 |
| CLI-010 | Runtime performance budgets: load time, frame time, memory, GPU memory and network use, measured with `game:budget` in a real browser and usable in CI | Original | P2 |
