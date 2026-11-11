# @gamingalo/cli

Create, validate, and publish Gamingalo games.

## Install

```sh
npm install --save-dev @gamingalo/cli
```

The `gamingalo` command is then available through `npx` or package scripts:

```sh
npx gamingalo create my-game
npx gamingalo game:validate
npx gamingalo game:publish --channel live
```

For CI, set `GAMINGALO_TOKEN`, `GAMINGALO_API_URL`,
`GAMINGALO_SIGNING_KEY`, and `GAMINGALO_SIGNING_KEY_ID`. Standalone binaries
for Linux, macOS, and Windows are available from the
[GitHub releases](https://github.com/Grano22/gamingalo/releases).
