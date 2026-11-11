// Production entry point. This must never import './testing': the build fails if mock code reaches it.
export { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
export type { GamingaloConfig, SdkModule } from './config';
export type { Connection, GamingaloSdk, SdkEventHandler, SdkEventMap } from './facade';
export type {
  Accessibility,
  AccessibilityPreferences,
  AnnounceOptions,
  CanvasFilter,
  ContrastPreference,
  MirrorItem,
  MirrorRole,
} from './features/accessibility';
export type { CacheData, GameCache } from './features/cache';
export type { ConnectionState } from './features/connection';
export type { FeatureName, Features } from './features/discovery';
export type { FileData, FileInfo, GameFiles } from './features/files';
export {
  readEnvironment,
  type BrowserName,
  type CapabilityTier,
  type Environment,
  type EnvironmentInfo,
} from './features/environment';
export type {
  GeolocationOptions,
  GeolocationResult,
  KeyboardInfo,
  KeyboardLayoutName,
  LocaleDetection,
  Localization,
  MessageParams,
  TextDirection,
} from './features/localization';
export type { MeasureOptions, Network, NetworkInfo, NetworkMeasurement } from './features/network';
export type {
  JsonValue,
  PreferenceChange,
  PreferenceDefinition,
  Preferences,
} from './features/preferences';
export type { Player, PlayerProfile } from './features/player';
export type { GamingaloPlugin, PluginContext } from './features/plugins';
export type { SaveInfo, SaveRecord, SaveSchema, Saves } from './features/saves';
export type { SessionMemory } from './features/session';
export {
  resolveGraphics,
  type GraphicsPreset,
  type GraphicsSettings,
  type QualityLevel,
  type Settings,
} from './features/settings';
export type { StorageEstimate, StorageInfo } from './features/storage';
export { Gamingalo, SDK_VERSION, STORAGE_FORMAT_VERSION, type GamingaloEntry } from './gamingalo';
export type { RealmFrame, RealmInfo, RealmOptions } from './realm';
