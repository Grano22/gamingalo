import { metaResponseSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';

export function registerMetaRoutes(app: FastifyInstance, version: string): void {
  app.get('/v1/meta', async () => metaResponseSchema.parse({ service: 'gamingalo-api', version, apiVersion: 'v1' }));
}
