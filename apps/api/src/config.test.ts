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
    const web = { WEB_ORIGIN: 'https://play.example', RP_ID: 'play.example', GAMES_BASE_URL: 'https://games.example', STORAGE_DIR: '/data' };
    expect(() => loadConfig({ NODE_ENV: 'production', ...web })).toThrow(/DATABASE_URL is required/);
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', ...web }).databaseUrl).toBeDefined();
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

describe('identity configuration', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://u:p@h/db',
    GAMES_BASE_URL: 'https://games.example',
    STORAGE_DIR: '/data',
  };

  it('uses insecure cookies only outside production', () => {
    expect(loadConfig({}).cookieSecure).toBe(false);
    expect(loadConfig({ ...production, WEB_ORIGIN: 'https://play.example', RP_ID: 'play.example' }).cookieSecure).toBe(
      true,
    );
  });

  it('refuses insecure settings in production', () => {
    const secure = { ...production, WEB_ORIGIN: 'https://play.example', RP_ID: 'play.example' };
    expect(() => loadConfig({ ...secure, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...production, WEB_ORIGIN: 'http://play.example', RP_ID: 'play.example' })).toThrow(
      /https/,
    );
  });

  it('needs an RP ID that matches the web origin', () => {
    expect(loadConfig({ WEB_ORIGIN: 'https://play.example.com', RP_ID: 'example.com' }).rpId).toBe('example.com');
    expect(() => loadConfig({ WEB_ORIGIN: 'https://play.example.com', RP_ID: 'evil.com' })).toThrow(/RP_ID/);
    expect(() => loadConfig({ WEB_ORIGIN: 'https://notexample.com', RP_ID: 'example.com' })).toThrow(/RP_ID/);
  });

  it('normalizes the web origin', () => {
    expect(loadConfig({ WEB_ORIGIN: 'http://localhost:4200/some/path' }).webOrigin).toBe('http://localhost:4200');
  });
});

describe('hosting configuration', () => {
  it('refuses games on the same site as the platform', () => {
    const production = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', STORAGE_DIR: '/data', RP_ID: 'play.example' };
    expect(() =>
      loadConfig({ ...production, WEB_ORIGIN: 'https://play.example', GAMES_BASE_URL: 'https://games.play.example' }),
    ).toThrow(/share a site/);
    expect(() => loadConfig({ WEB_ORIGIN: 'http://localhost:4200', GAMES_BASE_URL: 'http://localhost:3001' })).toThrow(
      /share a site/,
    );
    expect(loadConfig({}).gamesBaseUrl.hostname).toBe('games.localhost');
  });

  it('needs https and storage for games in production', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', WEB_ORIGIN: 'https://play.example', RP_ID: 'play.example' };
    expect(() => loadConfig({ ...base, GAMES_BASE_URL: 'http://games.example', STORAGE_DIR: '/data' })).toThrow(/GAMES_BASE_URL must use https/);
    expect(() => loadConfig({ ...base, GAMES_BASE_URL: 'https://games.example' })).toThrow(/STORAGE_DIR/);
  });
});
