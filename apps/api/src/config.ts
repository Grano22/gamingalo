import * as z from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  CORS_ORIGINS: z.string().default(''),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
});

export interface Config {
  environment: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  databaseUrl: string | undefined;
  corsOrigins: string[];
  bodyLimitBytes: number;
}

/** Throws on invalid configuration, so that a misconfigured service never starts. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Only names and reasons, because values could contain secrets such as a database password.
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid configuration. ${details}`);
  }
  const values = result.data;
  if (values.NODE_ENV === 'production' && !values.DATABASE_URL) {
    throw new Error('Invalid configuration. DATABASE_URL is required in production.');
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
  };
}
