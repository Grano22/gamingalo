import { healthResponseSchema, readyResponseSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../../db/database';
import { unavailable } from '../../errors';

export function registerHealthRoutes(app: FastifyInstance, database: Queryable): void {
  app.get('/health', { logLevel: 'warn' }, async () => healthResponseSchema.parse({ status: 'ok' }));

  app.get('/ready', { logLevel: 'warn' }, async () => {
    try {
      await database.query('SELECT 1');
    } catch (error) {
      throw unavailable('The database is not reachable.', error);
    }
    return readyResponseSchema.parse({ status: 'ready' });
  });
}
