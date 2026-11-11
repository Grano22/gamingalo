import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from './app';
import { loadConfig, type Config } from './config';
import type { Database } from './db/database';
import { migrate } from './db/migrate';
import { migrations } from './db/migrations';
import { createPgliteDatabase } from './db/pglite';
import { buildGamesApp } from './games-server';
import { createMemoryBlobStore, type BlobStore } from './storage/blob-store';

export interface TestService {
  app: FastifyInstance;
  database: Database;
  config: Config;
  store: BlobStore;
  games: FastifyInstance;
  close(): Promise<void>;
}

export async function startService(env: Record<string, string> = {}): Promise<TestService> {
  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', AUTH_RATE_LIMIT: '1000', ...env });
  const database = await createPgliteDatabase();
  await migrate(database, migrations);
  const store = createMemoryBlobStore();
  const app = await buildApp({ config, database, store });
  const games = buildGamesApp(config, database, store);
  return {
    app,
    database,
    config,
    store,
    games,
    close: async () => {
      await app.close();
      await games.close();
      await database.close();
    },
  };
}

/** A browser-like client: it keeps cookies and sends the web platform's origin. */
export function browser(service: TestService) {
  const jar = new Map<string, string>();
  const send = async (options: InjectOptions & { url: string }): Promise<LightMyRequestResponse> => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    const response = await service.app.inject({
      ...options,
      headers: { origin: service.config.webOrigin, ...(cookie ? { cookie } : {}), ...options.headers },
    });
    for (const set of response.cookies as Array<{ name: string; value: string; maxAge?: number; expires?: Date }>) {
      const expired = set.maxAge === 0 || (set.expires !== undefined && set.expires.getTime() <= Date.now());
      if (expired || set.value === '') jar.delete(set.name);
      else jar.set(set.name, set.value);
    }
    return response;
  };
  return {
    jar,
    get: (url: string) => send({ method: 'GET', url }),
    post: (url: string, body: unknown = {}) => send({ method: 'POST', url, payload: body as object }),
    patch: (url: string, body: unknown) => send({ method: 'PATCH', url, payload: body as object }),
    put: (url: string, body: unknown) => send({ method: 'PUT', url, payload: body as object }),
    delete: (url: string, body?: unknown) =>
      send({ method: 'DELETE', url, ...(body === undefined ? {} : { payload: body as object }) }),
    send,
  };
}

/** A creator: a guest account upgraded to registered, as a passkey would do, with an API token for the CLI. */
export async function creator(service: TestService) {
  const client = browser(service);
  const created = await client.post('/v1/accounts/guest', { ageBand: '16plus' });
  const accountId = (created.json() as { id: string }).id;
  await service.database.query("UPDATE accounts SET kind = 'registered' WHERE id = $1", [accountId]);
  const token = ((await client.post('/v1/me/tokens', { name: 'CI' })).json() as { token: string }).token;

  /** A CLI-like client: an API token, and no origin or cookies. */
  const cli = (options: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; payload?: unknown; contentType?: string }) =>
    service.app.inject({
      method: options.method,
      url: options.url,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.contentType ? { 'content-type': options.contentType } : {}),
      },
      ...(options.payload === undefined ? {} : { payload: options.payload as string }),
    });
  return { client, accountId, token, cli };
}
