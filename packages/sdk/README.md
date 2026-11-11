# @gamingalo/sdk

Framework-free TypeScript SDK for Gamingalo games.

## Install

```sh
npm install @gamingalo/sdk
```

## Start

```ts
import { Gamingalo } from '@gamingalo/sdk';

const sdk = await Gamingalo.init({
  gameId: 'my-game',
  realm: { canvas },
  modules: ['accessibility', 'localization'],
});

sdk.on('suspend', () => game.pause());
```

The SDK provides saves, preferences, accessibility, localization, player
identity, environment and network information, storage, files, and plugins.
See the [SDK documentation](https://grano22.github.io/gamingalo/docs/sdk).

For tests, import `createMockSdk` from `@gamingalo/sdk/testing`. The testing
entry point is not included in the production entry point.
