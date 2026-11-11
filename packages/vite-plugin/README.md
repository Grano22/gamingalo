# @gamingalo/vite-plugin

Adds installed Gamingalo plugin packages to the SDK at build time.

## Install

```sh
npm install --save-dev @gamingalo/vite-plugin
```

## Configure

```ts
import { defineConfig } from 'vite';
import { gamingalo } from '@gamingalo/vite-plugin';

export default defineConfig({
  plugins: [gamingalo()],
});
```

Then import `plugins` from `virtual:gamingalo-plugins` and pass it to
`Gamingalo.init({ plugins })`. Plugin options belong in `gamingalo.json`;
installed plugins declare their compatibility and are checked during the build.
