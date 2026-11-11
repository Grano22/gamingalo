import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import { fail } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Refuses state-changing requests from other sites. Browsers always send `Origin` on these
 * requests, so a missing one is refused too. Together with `SameSite=Lax` cookies, this protects
 * against cross-site request forgery.
 */
export function registerOriginCheck(app: FastifyInstance, config: Config): void {
  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method) || !request.url.startsWith('/v1/')) return;
    // API tokens aren't sent by browsers on their own, so token requests can't be forged cross-site.
    // Routes that accept a token ignore cookies when one is present.
    if (request.headers.authorization?.startsWith('Bearer ')) return;
    if (request.headers.origin !== config.webOrigin) {
      throw fail('FORBIDDEN', 'This request must come from the Gamingalo web platform.');
    }
  });
}
