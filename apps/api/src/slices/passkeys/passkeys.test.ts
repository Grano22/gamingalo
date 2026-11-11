import { errorResponseSchema, passkeyOptionsResponseSchema } from '@gamingalo/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browser, startService, type TestService } from '../../test-support';

let service: TestService;

beforeEach(async () => {
  service = await startService();
});

afterEach(async () => {
  await service.close();
});

const codeOf = (response: { json(): unknown }) => errorResponseSchema.parse(response.json()).error.code;
const fakeCredential = { id: 'not-a-real-credential', rawId: 'x', type: 'public-key', response: {} };

async function signedIn(ageBand = '16plus') {
  const client = browser(service);
  await client.post('/v1/accounts/guest', { ageBand });
  return client;
}

describe('registration', () => {
  it('needs a session', async () => {
    expect(codeOf(await browser(service).post('/v1/passkeys/registration/options'))).toBe('UNAUTHENTICATED');
  });

  it('gives options for this site that require a discoverable passkey', async () => {
    const client = await signedIn();
    const { challengeId, options } = passkeyOptionsResponseSchema.parse(
      (await client.post('/v1/passkeys/registration/options')).json(),
    );
    expect(challengeId).toBeTruthy();
    expect(options).toMatchObject({
      rp: { id: 'localhost', name: 'Gamingalo' },
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required' },
    });
  });

  it('needs parental consent for under 13s', async () => {
    const client = await signedIn('under13');
    const response = await client.post('/v1/passkeys/registration/options');
    expect(response.statusCode).toBe(403);
    expect(codeOf(response)).toBe('PARENTAL_CONSENT_REQUIRED');
  });

  it('refuses a bad response, and the challenge cannot be reused', async () => {
    const client = await signedIn();
    const { challengeId } = passkeyOptionsResponseSchema.parse(
      (await client.post('/v1/passkeys/registration/options')).json(),
    );

    const first = await client.post('/v1/passkeys/registration/verify', { challengeId, credential: fakeCredential });
    const replay = await client.post('/v1/passkeys/registration/verify', { challengeId, credential: fakeCredential });

    expect(first.statusCode).toBe(401);
    expect(codeOf(first)).toBe('UNAUTHENTICATED');
    expect(codeOf(replay)).toBe('UNAUTHENTICATED');
    expect((await service.database.query('SELECT 1 FROM passkeys')).rows).toEqual([]);
  });

  it("refuses another account's challenge", async () => {
    const owner = await signedIn();
    const { challengeId } = passkeyOptionsResponseSchema.parse(
      (await owner.post('/v1/passkeys/registration/options')).json(),
    );
    const other = await signedIn();
    const response = await other.post('/v1/passkeys/registration/verify', { challengeId, credential: fakeCredential });
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('refuses an expired challenge', async () => {
    const client = await signedIn();
    const { challengeId } = passkeyOptionsResponseSchema.parse(
      (await client.post('/v1/passkeys/registration/options')).json(),
    );
    await service.database.query("UPDATE webauthn_challenges SET expires_at = now() - interval '1 second'");
    const response = await client.post('/v1/passkeys/registration/verify', { challengeId, credential: fakeCredential });
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed request', async () => {
    const client = await signedIn();
    const response = await client.post('/v1/passkeys/registration/verify', { challengeId: 'nope', credential: {} });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
  });
});

describe('sign-in', () => {
  it('gives options without a session, and allows any saved passkey', async () => {
    const response = await browser(service).post('/v1/passkeys/login/options');
    const { options } = passkeyOptionsResponseSchema.parse(response.json());
    expect(options).toMatchObject({ rpId: 'localhost' });
    expect((options as { allowCredentials?: unknown[] }).allowCredentials ?? []).toEqual([]);
  });

  it('refuses an unknown passkey with the same answer as any other failure', async () => {
    const client = browser(service);
    const { challengeId } = passkeyOptionsResponseSchema.parse((await client.post('/v1/passkeys/login/options')).json());
    const response = await client.post('/v1/passkeys/login/verify', { challengeId, credential: fakeCredential });
    expect(response.statusCode).toBe(401);
    expect(errorResponseSchema.parse(response.json()).error.message).toBe('The passkey could not be verified.');
    expect(client.jar.size).toBe(0);
  });

  it('refuses a registration challenge used for sign-in', async () => {
    const client = await signedIn();
    const { challengeId } = passkeyOptionsResponseSchema.parse(
      (await client.post('/v1/passkeys/registration/options')).json(),
    );
    const response = await client.post('/v1/passkeys/login/verify', { challengeId, credential: fakeCredential });
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('removes expired challenges as new ones are made', async () => {
    const client = browser(service);
    await client.post('/v1/passkeys/login/options');
    await service.database.query("UPDATE webauthn_challenges SET expires_at = now() - interval '1 second'");
    await client.post('/v1/passkeys/login/options');
    expect((await service.database.query('SELECT 1 FROM webauthn_challenges')).rows).toHaveLength(1);
  });
});
