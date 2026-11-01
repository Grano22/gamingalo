import { GamingaloError } from '@gamingalo/errors';
import * as z from 'zod/mini';
import { CONNECTION_STATES, type ConnectionState } from './connection';
import type { EnvironmentInfo } from './environment';
import { FEATURE_NAMES, type FeatureName } from './features';

const configSchema = z.strictObject({
  gameId: z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,62}$/)),
  mode: z.optional(z.enum(['production', 'mock'])),
  mock: z.optional(
    z.strictObject({
      connection: z.optional(z.enum(CONNECTION_STATES)),
      features: z.optional(z.array(z.enum(FEATURE_NAMES))),
      environment: z.optional(z.record(z.string(), z.unknown())),
    }),
  ),
});

export type GamingaloMode = 'production' | 'mock';

export interface MockOptions {
  /** Starting connection state. Defaults to `online`. */
  connection?: ConnectionState;
  /** Features reported as available. Defaults to none. */
  features?: FeatureName[];
  /** Replaces top-level sections of the fixed mock environment. */
  environment?: Partial<EnvironmentInfo>;
}

export interface GamingaloConfig {
  /** Lowercase letters, digits and hyphens. */
  gameId: string;
  /** `mock` runs without a backend, with state controlled through `sdk.mock`. Defaults to `production`. */
  mode?: GamingaloMode;
  /** Only allowed when `mode` is `mock`. */
  mock?: MockOptions;
}

export interface ResolvedConfig {
  gameId: string;
  mode: GamingaloMode;
  mock: { connection: ConnectionState; features: FeatureName[]; environment: Partial<EnvironmentInfo> };
}

export function resolveConfig(input: unknown): ResolvedConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new GamingaloError('INVALID_CONFIG', `Invalid SDK configuration. ${details}`);
  }

  const { gameId, mode = 'production', mock } = result.data;
  if (mock && mode !== 'mock') {
    throw new GamingaloError('INVALID_CONFIG', 'Invalid SDK configuration. mock: requires mode "mock"');
  }

  return {
    gameId,
    mode,
    mock: {
      connection: mock?.connection ?? 'online',
      features: [...new Set(mock?.features ?? [])].sort(),
      environment: (mock?.environment ?? {}) as Partial<EnvironmentInfo>,
    },
  };
}
