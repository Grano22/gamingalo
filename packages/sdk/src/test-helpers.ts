import type { GamingaloConfig, GamingaloSdk } from './index';
import { Gamingalo } from './index';

const started: GamingaloSdk[] = [];

/** Starts the production SDK and remembers the reference, since it can't be looked up later. */
export async function startSdk(config: GamingaloConfig = { gameId: 'my-game' }): Promise<GamingaloSdk> {
  const sdk = await Gamingalo.init(config);
  started.push(sdk);
  return sdk;
}

export async function stopSdks(): Promise<void> {
  for (const sdk of started.splice(0)) await sdk.shutdown();
}
