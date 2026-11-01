/** Features a game can ask about. Each one becomes available when its spec ships. */
export const FEATURE_NAMES = [
  'saves',
  'files',
  'profiles',
  'social',
  'achievements',
  'scores',
  'payments',
  'moderation',
  'multiplayer',
  'capture',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface Features {
  /** Returns `false`, and never throws, for anything unavailable or unknown. */
  has(name: string): boolean;
}
