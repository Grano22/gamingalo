import type { Environment } from './environment';
import type { Preferences } from './preferences';
import type { RealmInfo } from '../realm';

/** What a plugin can use. It doesn't include the facade's internal controls. */
export interface PluginContext {
  readonly gameId: string;
  readonly realm: RealmInfo;
  readonly environment: Environment;
  /** Stored separately from the game's preferences and from other plugins'. */
  readonly preferences: Preferences;
  /** Sets this plugin's own CSS filter layer on the bound canvas. An empty value removes it. */
  setCanvasFilter(value: string): void;
  /** Runs when the SDK shuts down, or if a later plugin fails to start. Newest first. */
  addCleanup(cleanup: () => void): void;
}

/**
 * An optional SDK module. `setup` returns the plugin's API, which a game gets with `sdk.use(plugin)`.
 * Plugins run with the same access as the game, because they're code the game chose to include.
 */
export interface GamingaloPlugin<Api extends object = object> {
  /** Unique within a game. Lowercase letters, digits, `-`, `_`, `@` and `/`. */
  readonly name: string;
  setup(context: PluginContext): Api;
}
