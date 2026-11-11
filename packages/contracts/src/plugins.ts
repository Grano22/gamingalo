import * as z from 'zod';
import { FORMAT_VERSIONS } from './versions';

/**
 * The `gamingalo` field in a plugin package's `package.json`. Installing a package that has one,
 * as a dependency, adds the plugin to the game's SDK at build time.
 */
export const pluginManifestSchema = z.strictObject({
  formatVersion: z.literal(FORMAT_VERSIONS.pluginManifest),
  /** The named export of the package's main entry: a function that takes options and returns the plugin. */
  export: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, 'Use a JavaScript identifier.')
    .default('gamingaloPlugin'),
  /** The SDK versions this plugin works with, as a semver range such as ">=0.14.0 <1.0.0". */
  sdk: z.string().min(1),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
