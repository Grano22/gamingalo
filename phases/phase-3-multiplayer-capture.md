# Phase 3: Multiplayer and capture

**Goal:** real-time multiplayer and shareable captures.

## Specs

| Spec | Covers | Status |
|---|---|---|
| `networking_0.1.0` | BE-016, SDK-020, SDK-023 | In progress |
| `multiplayer-services_0.1.0` | BE-017, BE-018, SDK-021, SDK-022, SDK-042 | Not started |
| `custom-server-protocol_0.1.0` | SRV-001 | Not started |
| `capture_0.1.0` | BE-019, SDK-024, WEB-013 | Not started |
| `player-imports_0.1.0` | SDK-025 | Not started |
| `quick-resume-cloud_0.1.0` | WRAP-007 | Not started |
| `engine-expansion_0.1.0` | WRAP-008 | Not started |

## Exit criteria

* [ ] Two players on different networks connect, including behind symmetric NAT using TURN.
* [ ] Default peer-to-peer settings don't reveal a player's IP address to other players.
* [ ] A sample game plays over both P2P and a certified server with the same matchmaking API.
* [ ] The Network API reports ping, jitter and throughput that match a controlled test network within agreed limits.
* [ ] Public captures and imported files pass through moderation before others can see them.
* [ ] A capture can be saved privately, shared publicly, or downloaded. Unsupported browsers get a clear result.
* [ ] Paid-plan players can resume across two devices.
* [ ] A sample custom server defines its own game modes and matchmaking rules, using only the documented protocol.
* [ ] TURN and media storage costs are tracked against the cost model.

## Risks

* TURN and video storage are the largest variable costs so far. Set quotas before launch.
* The `capture` design must leave room for no-capture sections (SDK-030), which arrive in Phase 4.
