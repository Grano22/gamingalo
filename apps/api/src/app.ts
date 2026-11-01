import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';
import type { Database } from './db/database';
import { handleError, handleNotFound } from './errors';
import { registerHealthRoutes } from './slices/health/routes';
import { registerMetaRoutes } from './slices/meta/routes';

export const SERVICE_VERSION = '0.1.0';

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

  registerHealthRoutes(app, database);
  registerMetaRoutes(app, SERVICE_VERSION);

  return app;
}
