import { healthResponseSchema, readyResponseSchema } from '@gamingalo/contracts';
import type { FastifyInstance, LogLevel } from 'fastify';
import type { Queryable } from '../../db/database';
import { unavailable } from '../../errors';

const LEVELS: readonly string[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];

/** Health checks run often, so they log at `warn` at most. A quieter service setting still wins. */
function quieter(configured: string): LogLevel {
  return (LEVELS.indexOf(configured) > LEVELS.indexOf('warn') ? configured : 'warn') as LogLevel;
}

export function registerHealthRoutes(app: FastifyInstance, database: Queryable, logLevel: string): void {
  const options = { logLevel: quieter(logLevel) };
  app.get('/health', options, async () => healthResponseSchema.parse({ status: 'ok' }));

  app.get('/ready', options, async () => {
    try {
      await database.query('SELECT 1');
    } catch (error) {
      throw unavailable('The database is not reachable.', error);
    }
    return readyResponseSchema.parse({ status: 'ready' });
  });
}
