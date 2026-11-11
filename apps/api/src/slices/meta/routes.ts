import { FORMAT_VERSIONS, metaResponseSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';

export function registerMetaRoutes(app: FastifyInstance, version: string): void {
  app.get('/v1/meta', async () => metaResponseSchema.parse({
      service: 'gamingalo-api',
      version,
      apiVersion: 'v1',
      formats: { gameConfig: FORMAT_VERSIONS.gameConfig, manifest: FORMAT_VERSIONS.manifest, api: FORMAT_VERSIONS.api },
    }));
}
