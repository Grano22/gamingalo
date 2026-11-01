import { errorResponseSchema, healthResponseSchema, metaResponseSchema, readyResponseSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp, SERVICE_VERSION } from './app';
import { loadConfig } from './config';
import { createPgliteDatabase } from './db/pglite';
import type { Database } from './db/database';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', CORS_ORIGINS: 'https://play.example' });

describe('routes', () => {
  let database: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    database = await createPgliteDatabase();
    app = await buildApp({ config, database });
    app.get('/test/boom', async () => {
      throw new Error('secret database password in message');
    });
    app.post('/test/echo', async () => ({ status: 'ok' }));
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('reports health and readiness using the contracts', async () => {
    const health = await app.inject({ url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(healthResponseSchema.parse(health.json())).toEqual({ status: 'ok' });

    const ready = await app.inject({ url: '/ready' });
    expect(ready.statusCode).toBe(200);
    expect(readyResponseSchema.parse(ready.json())).toEqual({ status: 'ready' });
  });

  it('reports service metadata', async () => {
    const meta = metaResponseSchema.parse((await app.inject({ url: '/v1/meta' })).json());
    expect(meta).toEqual({ service: 'gamingalo-api', version: SERVICE_VERSION, apiVersion: 'v1' });
  });

  it('returns the error shape for unknown routes', async () => {
    const response = await app.inject({ url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('hides details of unexpected errors', async () => {
    const response = await app.inject({ url: '/test/boom' });
    const { error } = errorResponseSchema.parse(response.json());
    expect(response.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL');
    expect(response.body).not.toContain('secret');
    expect(error.requestId).toBe(response.headers['x-request-id']);
  });

  it('returns the error shape for malformed input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{bad json',
    });
    expect(response.statusCode).toBe(400);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('INVALID_ARGUMENT');
  });

  it('allows listed origins only', async () => {
    const allowed = await app.inject({ url: '/health', headers: { origin: 'https://play.example' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://play.example');

    const denied = await app.inject({ url: '/health', headers: { origin: 'https://evil.example' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers and ignores client request IDs', async () => {
    const response = await app.inject({ url: '/health', headers: { 'x-request-id': 'forged' } });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-request-id']).not.toBe('forged');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('readiness', () => {
  it('returns 503 when the database fails, without details', async () => {
    const database: Database = {
      query: vi.fn(async () => {
        throw new Error('connection refused to db-host:5432');
      }),
      transaction: vi.fn(),
      close: vi.fn(async () => {}),
    };
    const app = await buildApp({ config, database });

    const response = await app.inject({ url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
    expect(response.body).not.toContain('db-host');
    await app.close();

    const health = await buildApp({ config, database });
    expect((await health.inject({ url: '/health' })).statusCode).toBe(200);
    await health.close();
  });
});
