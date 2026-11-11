# @gamingalo/plugin-screen-preferences

Player-adjustable brightness, contrast, saturation, and gamma for Gamingalo
games.

## Install

```sh
npm install @gamingalo/plugin-screen-preferences @gamingalo/vite-plugin
```

The package requires `@gamingalo/sdk` as a peer dependency.

## Use

The Vite plugin discovers installed Gamingalo plugins automatically. Add
`gamingalo()` to `vite.config.ts`, then use the generated plugin list:

```ts
import { Gamingalo } from '@gamingalo/sdk';
import { plugins } from 'virtual:gamingalo-plugins';

const sdk = await Gamingalo.init({
  gameId: 'my-game',
  realm: { canvas },
  plugins,
});

const screen = sdk.use(plugins.find((plugin) => plugin.name === 'screen-preferences')!);
screen.setBrightness(1.2);
```

See the [screen preferences documentation](https://grano22.github.io/gamingalo/docs/plugins/screen-preferences).
