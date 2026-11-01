# Requirements

Every requirement has a stable ID and belongs to one phase. IDs are never reused.

| File | Component |
|---|---|
| [sdk.md](sdk.md) | SDK |
| [game-wrapper.md](game-wrapper.md) | Game Wrapper |
| [web-platform.md](web-platform.md) | Web Platform |
| [backend.md](backend.md) | Backend |
| [cli.md](cli.md) | CLI |
| [mcp.md](mcp.md) | MCP Server |
| [cross-cutting.md](cross-cutting.md) | Security, compliance and engineering |

## Origin column

* **Original**: from the original `AGENTS.md` or `.draft/features.md`, unchanged in intent.
* **Changed**: original requirement, reshaped so it can work in a browser or meet legal requirements.
* **Proposed**: added during the requirements review.

## Phase column

`P0` to `P5` refer to files in `phases/`. `TBD` means the requirement is waiting on a decision. `Parked` means it is out of the plan until someone reopens it.

## Original requirements that were changed

| Original | Why it changed | Now |
|---|---|---|
| Network API returns MAC address | Browsers do not expose it | Removed |
| Network API returns IP address | Only a server can see the public IP, and it is personal data | Server-side only; games get a coarse region (SDK-023) |
| Block CDP, WebDriver, BiDi and AI cheating | Signals can be spoofed, and OS-level or camera-based bots look human | Risk signals scored on the server (SDK-031, BE-021) |
| Secured memory sectors | The player controls the runtime | Deterrent only, with authoritative values on the server (SDK-027) |
| Prevent extraction of models, scripts and SFX | Anything the client renders or runs can be extracted | Encryption, watermarking and server-side logic (SDK-028) |
| Protect cutscenes and music with DRM | Protected video cannot be drawn to a canvas or WebGPU texture | HTML media overlay using EME (SDK-029) |
| Protect patented mechanics | Client code is readable, and patents are public anyway | Secret logic runs on the server (documented guidance in SDK-028) |
| Built-in screen reader as a fallback | Canvas content is invisible to assistive tech, and a full reader is a separate product | ARIA layer plus optional speech output (SDK-018) |
| Settings API controls WebGPU | The SDK does not own the game's renderer | Presets that games opt into (SDK-008) |
| Generic Quick Resume | JS heap and GPU state cannot be snapshotted | Save and restore contract implemented by the game (WRAP-006) |
| Fingerprint in game stats | Generally requires consent under EU ePrivacy rules | First-party ID by default (WRAP-005, D-18) |
| NFT and web3 marketplace | Regulatory cost with no core product need | Parked (WEB-021) |
