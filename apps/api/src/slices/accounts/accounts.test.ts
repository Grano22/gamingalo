import { accountResponseSchema, errorResponseSchema, exportResponseSchema } from '@gamingalo/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../../auth/sessions';
import { browser, startService, type TestService } from '../../test-support';

let service: TestService;

beforeEach(async () => {
  service = await startService();
});

afterEach(async () => {
  await service.close();
});

const codeOf = (response: { json(): unknown }) => errorResponseSchema.parse(response.json()).error.code;

async function guest(ageBand = '16plus') {
  const client = browser(service);
  const response = await client.post('/v1/accounts/guest', { ageBand });
  expect(response.statusCode).toBe(201);
  return { client, account: accountResponseSchema.parse(response.json()) };
}

describe('guest accounts', () => {
  it('creates an account and a session in a protected cookie', async () => {
    const client = browser(service);
    const response = await client.post('/v1/accounts/guest', { ageBand: '16plus' });
    const account = accountResponseSchema.parse(response.json());
    const cookie = (response.cookies as Array<Record<string, unknown>>)[0];

    expect(account).toMatchObject({ kind: 'guest', ageBand: '16plus', minor: false, passkeys: 0 });
    expect(account.displayName).toMatch(/^Player-[0-9a-f]{4}$/);
    expect(cookie).toMatchObject({ name: 'gamingalo_session', httpOnly: true, sameSite: 'Lax', path: '/' });

    const me = await client.get('/v1/me');
    expect(accountResponseSchema.parse(me.json()).id).toBe(account.id);
  });

  it('stores only a hash of the session token', async () => {
    const { client } = await guest();
    const token = client.jar.get('gamingalo_session') as string;
    const { rows } = await service.database.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(rows).toEqual([{ token_hash: hashToken(token) }]);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it.each([
    ['13to15', true],
    ['under13', true],
    ['16plus', false],
  ])('marks %s as minor: %s', async (ageBand, minor) => {
    expect((await guest(ageBand)).account.minor).toBe(minor);
  });

  it('rejects a missing or unknown age band', async () => {
    const client = browser(service);
    expect(codeOf(await client.post('/v1/accounts/guest', {}))).toBe('INVALID_ARGUMENT');
    expect(codeOf(await client.post('/v1/accounts/guest', { ageBand: '21' }))).toBe('INVALID_ARGUMENT');
    expect(codeOf(await client.post('/v1/accounts/guest', { ageBand: '16plus', birthDate: '2000-01-01' }))).toBe(
      'INVALID_ARGUMENT',
    );
  });

  it('refuses a second guest account while signed in', async () => {
    const { client } = await guest();
    expect(codeOf(await client.post('/v1/accounts/guest', { ageBand: '16plus' }))).toBe('CONFLICT');
  });
});

describe('sessions', () => {
  it('needs a session for account routes', async () => {
    const response = await browser(service).get('/v1/me');
    expect(response.statusCode).toBe(401);
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('ends the session on the server when signing out', async () => {
    const { client } = await guest();
    const copied = client.jar.get('gamingalo_session') as string;

    expect((await client.delete('/v1/sessions/current')).statusCode).toBe(204);
    expect((await client.get('/v1/me')).statusCode).toBe(401);

    const thief = browser(service);
    thief.jar.set('gamingalo_session', copied);
    expect((await thief.get('/v1/me')).statusCode).toBe(401);
  });

  it('refuses an expired session', async () => {
    const { client } = await guest();
    await service.database.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect((await client.get('/v1/me')).statusCode).toBe(401);
  });

  it('extends a session once half of its life has passed', async () => {
    const { client } = await guest();
    await service.database.query("UPDATE sessions SET expires_at = now() + interval '2 days'");

    const response = await client.get('/v1/me');

    expect(response.cookies).toHaveLength(1);
    const { rows } = await service.database.query<{ days: number }>(
      'SELECT extract(day FROM expires_at - now())::int AS days FROM sessions',
    );
    expect(rows[0]?.days).toBeGreaterThanOrEqual(29);
  });

  it('does not touch a fresh session', async () => {
    const { client } = await guest();
    expect((await client.get('/v1/me')).cookies).toHaveLength(0);
  });

  it('uses a __Host- cookie when cookies are secure', async () => {
    await service.close();
    service = await startService({ COOKIE_SECURE: 'true' });
    const response = await browser(service).post('/v1/accounts/guest', { ageBand: '16plus' });
    expect((response.cookies as Array<Record<string, unknown>>)[0]).toMatchObject({
      name: '__Host-gamingalo_session',
      secure: true,
    });
  });
});

describe('cross-site protection', () => {
  it('refuses changes from another origin, or with no origin', async () => {
    const client = browser(service);
    const evil = await client.send({
      method: 'POST',
      url: '/v1/accounts/guest',
      payload: { ageBand: '16plus' },
      headers: { origin: 'https://evil.example' },
    });
    expect(evil.statusCode).toBe(403);
    expect(codeOf(evil)).toBe('FORBIDDEN');

    const none = await service.app.inject({ method: 'POST', url: '/v1/accounts/guest', payload: { ageBand: '16plus' } });
    expect(none.statusCode).toBe(403);
    const { rows } = await service.database.query('SELECT id FROM accounts');
    expect(rows).toEqual([]);
  });

  it('allows reads without an origin', async () => {
    expect((await service.app.inject({ url: '/v1/meta' })).statusCode).toBe(200);
  });

  it('rate-limits sign-in routes', async () => {
    await service.close();
    service = await startService({ AUTH_RATE_LIMIT: '2' });
    const client = browser(service);
    await client.post('/v1/passkeys/login/options');
    await client.post('/v1/passkeys/login/options');
    const limited = await client.post('/v1/passkeys/login/options');
    expect(limited.statusCode).toBe(429);
    expect(codeOf(limited)).toBe('RATE_LIMITED');
  });
});

describe('profile', () => {
  it('changes the display name, trimming spaces', async () => {
    const { client } = await guest();
    const response = await client.patch('/v1/me', { displayName: '  Ada  ' });
    expect(accountResponseSchema.parse(response.json()).displayName).toBe('Ada');
  });

  it.each([
    ['empty', '   '],
    ['too long', 'x'.repeat(33)],
    ['a control character', 'Ada\u0007'],
    ['an invisible character', 'Ad​a'],
    ['a direction override', 'Ada‮'],
  ])('rejects a name that is %s', async (_name, displayName) => {
    const { client } = await guest();
    expect(codeOf(await client.patch('/v1/me', { displayName }))).toBe('INVALID_ARGUMENT');
  });

  it('accepts names in other scripts and with emoji', async () => {
    const { client } = await guest();
    const response = await client.patch('/v1/me', { displayName: 'Zoë 李 🎮' });
    expect(accountResponseSchema.parse(response.json()).displayName).toBe('Zoë 李 🎮');
  });
});

describe('consents', () => {
  it('are off by default, and can be changed', async () => {
    const { client } = await guest();
    expect((await client.get('/v1/me/consents')).json()).toEqual({ analytics: false });
    await client.put('/v1/me/consents', { analytics: true });
    expect((await client.get('/v1/me/consents')).json()).toEqual({ analytics: true });
  });

  it('need parental consent for under 13s to turn on', async () => {
    const { client } = await guest('under13');
    const response = await client.put('/v1/me/consents', { analytics: true });
    expect(response.statusCode).toBe(403);
    expect(codeOf(response)).toBe('PARENTAL_CONSENT_REQUIRED');
    expect((await client.put('/v1/me/consents', { analytics: false })).statusCode).toBe(200);
  });
});

describe('export', () => {
  it('downloads everything held about the account, with no secrets', async () => {
    const { client, account } = await guest();
    await client.patch('/v1/me', { displayName: 'Ada' });
    const token = client.jar.get('gamingalo_session') as string;

    const response = await client.get('/v1/me/export');
    const data = exportResponseSchema.parse(response.json());

    expect(response.headers['content-disposition']).toContain('attachment');
    expect(data.account).toMatchObject({ id: account.id, displayName: 'Ada' });
    expect(data.consents).toEqual({ analytics: false });
    expect(data.sessions).toHaveLength(1);
    expect(response.body).not.toContain(token);
    expect(response.body).not.toContain(hashToken(token));
  });
});

describe('deletion', () => {
  it('deletes a guest account and everything linked to it', async () => {
    const { client } = await guest();
    const response = await client.delete('/v1/me', { confirm: 'DELETE' });
    expect(response.statusCode).toBe(204);
    expect((await client.get('/v1/me')).statusCode).toBe(401);

    for (const table of ['accounts', 'sessions', 'consents', 'passkeys', 'webauthn_challenges']) {
      const { rows } = await service.database.query(`SELECT 1 FROM ${table}`);
      expect(rows, table).toEqual([]);
    }
  });

  it('needs the confirmation', async () => {
    const { client } = await guest();
    expect(codeOf(await client.delete('/v1/me', { confirm: 'yes' }))).toBe('INVALID_ARGUMENT');
    expect((await client.get('/v1/me')).statusCode).toBe(200);
  });

  it('needs a recent sign-in for a registered account', async () => {
    const { client } = await guest();
    await service.database.query("UPDATE accounts SET kind = 'registered'");
    await service.database.query("UPDATE sessions SET authenticated_at = now() - interval '16 minutes'");
    const response = await client.delete('/v1/me', { confirm: 'DELETE' });
    expect(response.statusCode).toBe(403);
    expect(codeOf(response)).toBe('REAUTHENTICATION_REQUIRED');

    await service.database.query('UPDATE sessions SET authenticated_at = now()');
    expect((await client.delete('/v1/me', { confirm: 'DELETE' })).statusCode).toBe(204);
  });

  it('does not touch other accounts', async () => {
    const first = await guest();
    const second = await guest();
    await first.client.delete('/v1/me', { confirm: 'DELETE' });
    expect((await second.client.get('/v1/me')).statusCode).toBe(200);
  });
});
