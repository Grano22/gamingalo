import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerOriginCheck } from './auth/origin';
import type { Config } from './config';
import type { Database } from './db/database';
import { handleError, handleNotFound } from './errors';
import { registerAccountRoutes } from './slices/accounts/routes';
import { registerHealthRoutes } from './slices/health/routes';
import { registerMetaRoutes } from './slices/meta/routes';
import { registerPasskeyRoutes } from './slices/passkeys/routes';
import { registerSessionRoutes } from './slices/sessions/routes';

export const SERVICE_VERSION = '0.2.0';

export interface AppDependencies {
  config: Config;
  database: Database;
}

export async function buildApp({ config, database }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: config.bodyLimitBytes,
    // Always generated here, because a client-supplied ID could forge log entries.
    genReqId: () => randomUUID(),
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      serializers: {
        // Only what's needed, which leaves out IP addresses (D-18).
        req: (request) => ({ method: request.method, url: request.url }),
      },
    },
  });

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });
  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);

  await app.register(helmet);
  await app.register(cors, { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false });
  await app.register(cookie);
  // Limits are set per route. Addresses are held in memory only, and never stored (D-18).
  await app.register(rateLimit, { global: false });
  registerOriginCheck(app, config);

  registerHealthRoutes(app, database, config.logLevel);
  registerMetaRoutes(app, SERVICE_VERSION);
  registerAccountRoutes(app, database, config);
  registerPasskeyRoutes(app, database, config);
  registerSessionRoutes(app, database, config);

  return app;
}
