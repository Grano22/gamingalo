
## Shared Techstack
* Language - Typescript
* Monorepo - nx
* Module boundler - vite
* Unit/Functional Testing - vitest
* Schema validation:
  * zod (for internal structure enforcement)
  * json schema (for external semistructured files that project should support like: gamingalo.json)

## Components

### SDK

Core library for game makers that provides a facade of public methods from various features listed below.

#### Features
* Online Services:
  * Peer to Peer online multiplayer
  * Server based online multipler (cusotom + Gamingalo offical certified)
  * Profies
  * Friends
  * Profile Achievemnets
  * Player score
  * Trophies
  * Groups
* Game memory - use all web apis/features in browser to provide unified local and online storage for game saves, things created in game by player like club logo, also possiblity to read and upload things form otuside like from marketplace some addons or uploaded music for cusotm radio etc. IndexedDb and altneratives for local persistance and for only game session/local storage, cache etc. Also secured memory sectors to prevent from easy changing some props in mmeory like health in js.
* Online sync - on game load sync data, sync realtime progress etc
* DRM/Defedning the content from being stealed - Sophiscated APIs to prevent content extraction by player (in game secured content such as cutscenes, protected models, music, scripts mechanics for instance patented, sfx, etc), so assets can be protected
* Capture API - do screenshots/recordings/stream screen and safe (public/private) to the profile/locally download, stream.
* Accessiblity - High contrast filters, screen reader (can use browser one if supprots under the hood if nto it's own), 
* Anti automatin/outside control - only used controlled inputs, no AI for cheating, Automation browser/CDP/Webdriver/Bidi etc blocked form controlling the game/cheating.
* Paywall system with checks for paid content - loaded paid content only if player is allowed.
* Moderation API - detecting the sensitive content/swears etc.. photos, text, other uplaads. Can be limited intially.
* One time API - give to the game crwators psosiblity to perform action only once in secure way.
* Network API - Get IP, Mac, Game network session id, netork stats - ping, fluctuations, jitter, throughput, etc
* Environment API - browser, its capabalities, what device has turned on/off, device info, supproted displays, hardware etc
* Settings API - allows to control some webgpu, etc session from the high level and save cusotom Settings (Preferfeces AI)

#### Techstack

### Web Platform

### Architecture
* VSA (Verical Slice Architecture)

#### Techstack
* Framework - angular
* Unit/Functional Testing - testing-library
* UI:
  * Lucide
  * PrimeNG
  * Tailwinds
  * shadcn
* Shared state:
  * NgRx signals

### Game Wrapper

Game wrapper has core SDK + possiblity to mount on the game in pure JS, angular, react, vue etc. So it can be mount on canvas etc to inject its features

#### Features
* Game stats collection - number of unique players online/played, browser names/PWA, per country, fingerprint, unqiue game visits.
* Quick Resume

#### Techstack

### MCP Server

#### Features
* Exposing info about available 3D models and features that they have
* Public porfiles listing
* Public game stats

### CLI Component

CLI binary that helps the game producer to upload the game to the webplatform, debug SDK, 

#### Features
* Devtools for SDK
* Possiblity to publish game with one command `gamingalo game:publish` and gameSrttings.json
* Signing the game/securing it before upload
* Budget

#### Techstack
* Typescript + Node.js
* Framework - picocli
