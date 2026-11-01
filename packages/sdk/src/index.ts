export { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
export type { GamingaloConfig, GamingaloMode, MockOptions } from './config';
export type { ConnectionState } from './connection';
export type { BrowserName, CapabilityTier, Environment, EnvironmentInfo } from './environment';
export type { FeatureName, Features } from './features';
export {
  Gamingalo,
  type Connection,
  type GamingaloSdk,
  type MockControls,
  type SdkEventHandler,
  type SdkEventMap,
} from './sdk';
