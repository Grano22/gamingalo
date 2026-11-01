export { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
export type { GamingaloConfig, GamingaloMode, MockOptions } from './config';
export {
  Gamingalo,
  type Connection,
  type GamingaloSdk,
  type MockControls,
  type SdkEventHandler,
  type SdkEventMap,
} from './facade';
export type { ConnectionState } from './features/connection';
export type { FeatureName, Features } from './features/discovery';
export {
  readEnvironment,
  type BrowserName,
  type CapabilityTier,
  type Environment,
  type EnvironmentInfo,
} from './features/environment';
export {
  resolveGraphics,
  type GraphicsPreset,
  type GraphicsSettings,
  type JsonValue,
  type QualityLevel,
  type Settings,
} from './features/settings';
