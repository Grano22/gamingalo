// Production entry point. This must never import './testing': the build fails if mock code reaches it.
export { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
export type { GamingaloConfig } from './config';
export type { Connection, GamingaloSdk, SdkEventHandler, SdkEventMap } from './facade';
export type { CacheData, GameCache } from './features/cache';
export type { ConnectionState } from './features/connection';
export type { FeatureName, Features } from './features/discovery';
export {
  readEnvironment,
  type BrowserName,
  type CapabilityTier,
  type Environment,
  type EnvironmentInfo,
} from './features/environment';
export type { SaveInfo, SaveRecord, SaveSchema, Saves } from './features/saves';
export type { SessionMemory } from './features/session';
export {
  resolveGraphics,
  type GraphicsPreset,
  type GraphicsSettings,
  type JsonValue,
  type QualityLevel,
  type Settings,
} from './features/settings';
export type { StorageEstimate, StorageInfo } from './features/storage';
export { Gamingalo, type GamingaloEntry } from './gamingalo';
export type { RealmFrame, RealmInfo, RealmOptions } from './realm';
