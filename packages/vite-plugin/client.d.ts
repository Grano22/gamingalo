// Types for the module that @gamingalo/vite-plugin generates.
// Add `/// <reference types="@gamingalo/vite-plugin/client" />` to a file in your game, or list it in tsconfig `types`.
declare module 'virtual:gamingalo-plugins' {
  import type { GamingaloPlugin } from '@gamingalo/sdk';

  /** Every installed plugin package that isn't turned off, created with its options from gamingalo.json. */
  export const plugins: readonly GamingaloPlugin<object>[];
  /** The package names, in the same order as `plugins`. */
  export const pluginNames: readonly string[];
}
