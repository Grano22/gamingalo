import * as z from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  CORS_ORIGINS: z.string().default(''),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://localhost:4200'),
  RP_ID: z.string().min(1).default('localhost'),
  RP_NAME: z.string().min(1).default('Gamingalo'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
  API_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://localhost:3000'),
  GAMES_BASE_URL: z.url({ protocol: /^https?$/ }).default('http://games.localhost:3001'),
  GAMES_PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  STORAGE_DIR: z.string().min(1).optional(),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAX_VERSION_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  GUEST_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
});

export interface Config {
  environment: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  databaseUrl: string | undefined;
  corsOrigins: string[];
  bodyLimitBytes: number;
  /** The web platform's origin. State-changing requests must come from it. */
  webOrigin: string;
  /** The passkey relying party ID, which must be the web origin's host or a parent domain. */
  rpId: string;
  rpName: string;
  cookieSecure: boolean;
  sessionDays: number;
  /** Requests per minute for each sign-in route. */
  authRateLimit: number;
  /** Where games reach the web services. */
  apiOrigin: string;
  /** Games are served from subdomains of this address, which must be a separate registrable domain (D-13). */
  gamesBaseUrl: URL;
  gamesPort: number;
  /** Where uploaded game files are kept. Object storage replaces this in deployment. */
  storageDir: string | undefined;
  maxFileBytes: number;
  maxVersionBytes: number;
  /** Abandoned guest accounts are removed after this many days without a session. */
  guestRetentionDays: number;
}

function invalid(details: string): Error {
  return new Error(`Invalid configuration. ${details}`);
}

/** Throws on invalid configuration, so that a misconfigured service never starts. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Only names and reasons, because values could contain secrets such as a database password.
    throw invalid(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  }
  const values = result.data;
  const production = values.NODE_ENV === 'production';
  const webOrigin = new URL(values.WEB_ORIGIN).origin;
  const host = new URL(webOrigin).hostname;
  const cookieSecure = values.COOKIE_SECURE === undefined ? production : values.COOKIE_SECURE === 'true';

  if (production && !values.DATABASE_URL) throw invalid('DATABASE_URL is required in production.');
  if (production && !cookieSecure) throw invalid('COOKIE_SECURE can not be false in production.');
  if (production && !webOrigin.startsWith('https://')) throw invalid('WEB_ORIGIN must use https in production.');
  const gamesBaseUrl = new URL(values.GAMES_BASE_URL);
  const gamesHost = gamesBaseUrl.hostname;
  if (production && gamesBaseUrl.protocol !== 'https:') throw invalid('GAMES_BASE_URL must use https in production.');
  if (production && !values.STORAGE_DIR) throw invalid('STORAGE_DIR is required in production.');
  // Games on the platform's own site could reach its cookies, so production needs a separate site.
  // Local development uses `*.games.localhost` beside `localhost`, which is the same site, so only
  // the exact same host is refused there.
  const sharesSite = gamesHost.endsWith(`.${host}`) || host.endsWith(`.${gamesHost}`);
  if (gamesHost === host || (production && sharesSite)) {
    throw invalid('GAMES_BASE_URL must not share a site with WEB_ORIGIN.');
  }
  if (host !== values.RP_ID && !host.endsWith(`.${values.RP_ID}`)) {
    throw invalid('RP_ID must be the WEB_ORIGIN host or one of its parent domains.');
  }

  return {
    environment: values.NODE_ENV,
    host: values.HOST,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    databaseUrl: values.DATABASE_URL,
    corsOrigins: values.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    bodyLimitBytes: values.BODY_LIMIT_BYTES,
    webOrigin,
    rpId: values.RP_ID,
    rpName: values.RP_NAME,
    cookieSecure,
    sessionDays: values.SESSION_DAYS,
    authRateLimit: values.AUTH_RATE_LIMIT,
    apiOrigin: new URL(values.API_ORIGIN).origin,
    gamesBaseUrl,
    gamesPort: values.GAMES_PORT,
    storageDir: values.STORAGE_DIR,
    maxFileBytes: values.MAX_FILE_BYTES,
    maxVersionBytes: values.MAX_VERSION_BYTES,
    guestRetentionDays: values.GUEST_RETENTION_DAYS,
  };
}
