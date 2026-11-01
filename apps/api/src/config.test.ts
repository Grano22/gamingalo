import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('uses safe defaults, with no browser origins allowed', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ environment: 'development', host: '127.0.0.1', port: 3000, corsOrigins: [] });
    expect(config.databaseUrl).toBeUndefined();
  });

  it('parses origins', () => {
    expect(loadConfig({ CORS_ORIGINS: 'https://a.example, https://b.example' }).corsOrigins).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('refuses production without a database', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is required/);
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db' }).databaseUrl).toBeDefined();
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: 'nope' })).toThrow(/PORT/);
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('never includes values in errors, because they could contain passwords', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://user:hunter2@h/db' })).toThrow(/DATABASE_URL/);
    try {
      loadConfig({ DATABASE_URL: 'mysql://user:hunter2@h/db' });
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});
