import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerOriginCheck } from './auth/origin';
import type { Config } from './config';
import type { Database } from './db/database';
import { isGameOrigin } from './hosting';
import { registerApiTokenRoutes } from './slices/api-tokens/routes';
import { registerGameApiRoutes } from './slices/game-api/routes';
import { registerGameRoutes } from './slices/games/routes';
import type { BlobStore } from './storage/blob-store';
import { handleError, handleNotFound } from './errors';
import { registerAccountRoutes } from './slices/accounts/routes';
import { registerHealthRoutes } from './slices/health/routes';
import { registerMetaRoutes } from './slices/meta/routes';
import { registerPasskeyRoutes } from './slices/passkeys/routes';
import { registerSessionRoutes } from './slices/sessions/routes';

export const SERVICE_VERSION = '0.3.0';

export interface AppDependencies {
  config: Config;
  database: Database;
  store: BlobStore;
}

export async function buildApp({ config, database, store }: AppDependencies): Promise<FastifyInstance> {
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
  await app.register(cors, {
    // Games call the game API from their own origins, with a play token and no cookies.
    delegator: (request, callback) => {
      const origin = request.headers.origin;
      if (request.url.startsWith('/v1/game/') && isGameOrigin(config, origin)) {
        callback(null, { origin: true, credentials: false, methods: ['GET'], allowedHeaders: ['authorization'] });
        return;
      }
      callback(null, { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false });
    },
  });
  await app.register(cookie);
  // Limits are set per route. Addresses are held in memory only, and never stored (D-18).
  await app.register(rateLimit, { global: false });
  registerOriginCheck(app, config);

  registerHealthRoutes(app, database, config.logLevel);
  registerMetaRoutes(app, SERVICE_VERSION);
  registerAccountRoutes(app, database, config);
  registerPasskeyRoutes(app, database, config);
  registerSessionRoutes(app, database, config);
  registerApiTokenRoutes(app, database, config);
  registerGameRoutes(app, database, config, store);
  registerGameApiRoutes(app, database);

  return app;
}
