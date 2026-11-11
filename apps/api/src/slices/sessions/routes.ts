import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import type { Database } from '../../db/database';
import { endSession } from '../../auth/sessions';

export function registerSessionRoutes(app: FastifyInstance, database: Database, config: Config): void {
  app.delete('/v1/sessions/current', async (request, reply) => {
    await endSession(database, request, reply, config);
    void reply.status(204);
    return null;
  });
}
