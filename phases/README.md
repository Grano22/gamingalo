# Delivery plan

Phases are ordered by dependency. They have no dates yet, because team size isn't known.

| Phase | Goal | Audience at exit |
|---|---|---|
| [P0 Foundations](phase-0-foundations.md) | Settle the risky decisions and set up the repo | Internal |
| [P1 First playable](phase-1-first-playable.md) | A game maker can publish a game, and a player can play it and keep their saves | Invited game makers and testers |
| [P2 Social and monetization](phase-2-social-monetization.md) | Players connect, creators earn, and user content is moderated | Public launch |
| [P3 Multiplayer and capture](phase-3-multiplayer-capture.md) | Real-time play and shareable captures | Public |
| [P4 Protection and integrity](phase-4-protection-integrity.md) | Raise the cost of content theft and cheating | Public |
| [P5 Ecosystem](phase-5-ecosystem.md) | Marketplace, workshop, Forge and AI tools | Public |

## Why this order

* **Isolation comes before third-party games.** Moving games to new origins later would strand saves stored on the old ones.
* **Public launch waits for P2.** Payments, moderation and DSA processes must exist before opening to the public.
* **Moderation comes before public captures and imports.** P3 sharing depends on the P2 pipeline.
* **Protection comes after there is content to protect.** It's expensive, and the threat model from P0 decides how much of it to build.
* **The marketplace comes last.** It depends on payments, moderation and creator tools.

## Rules

* Each phase ends only when its exit criteria are met.
* A spec is written just before its work starts, so it reflects what earlier phases taught us.
* Specs in the same phase can run in parallel unless the phase says otherwise.

## Status values

`Not started`, `Draft`, `Approved`, `In progress`, `Done`. See `.specs/README.md`.
