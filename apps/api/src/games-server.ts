import { randomUUID } from 'node:crypto';
import { contentTypeFor } from '@gamingalo/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';
import type { Queryable } from './db/database';
import { parseGameHost } from './hosting';
import type { BlobStore } from './storage/blob-store';

/**
 * Games can run their own code, so they need tight limits: only their own files, only the platform
 * may embed them, and only the web services may be contacted. Games that need more, such as other
 * servers for multiplayer, will get it through their manifest later.
 */
export function gameSecurityHeaders(config: Config): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${config.apiOrigin}`,
    `frame-ancestors ${config.webOrigin}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
  return {
    'content-security-policy': csp,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-site',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
  };
}

/** Serves each game from its own origin, using the version live on the channel its host names. */
export function buildGamesApp(config: Config, database: Queryable, store: BlobStore): FastifyInstance {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: { level: config.logLevel, serializers: { req: (request) => ({ method: request.method, url: request.url }) } },
  });
  const headers = gameSecurityHeaders(config);

  app.get('/*', async (request, reply) => {
    const target = parseGameHost(config, request.headers.host);
    if (!target) return reply.status(404).type('text/plain').send('Not found');

    const pathname = new URL(request.url, 'http://game').pathname;
    let path: string;
    try {
      path = decodeURIComponent(pathname.slice(1));
    } catch {
      return reply.status(404).type('text/plain').send('Not found');
    }
    const column = target.channel === 'production' ? 'production_version' : 'preview_version';
    const { rows } = await database.query<{ sha256: string; path: string }>(
      `SELECT f.sha256, f.path
         FROM games g
         JOIN game_versions v ON v.game_id = g.id AND v.version = g.${column} AND v.status = 'ready'
         JOIN game_files f ON f.game_id = v.game_id AND f.version = v.version
        WHERE g.id = $1 AND f.path = CASE WHEN $2 = '' THEN v.entry ELSE $2 END`,
      [target.gameId, path],
    );
    const file = rows[0];
    const contentType = file && contentTypeFor(file.path);
    const bytes = file && contentType ? await store.get(file.sha256) : undefined;
    if (!file || !contentType || !bytes) return reply.status(404).headers(headers).type('text/plain').send('Not found');

    const etag = `"${file.sha256}"`;
    void reply.headers(headers).header('etag', etag).header('cache-control', 'no-cache');
    if (request.headers['if-none-match'] === etag) return reply.status(304).send();
    return reply.type(contentType).send(Buffer.from(bytes));
  });

  return app;
}
