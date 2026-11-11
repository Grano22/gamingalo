import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  canonicalManifest,
  catalogResponseSchema,
  errorResponseSchema,
  gameResponseSchema,
  playerProfileSchema,
  playTokenResponseSchema,
  uploadResponseSchema,
  versionListResponseSchema,
  type Manifest,
} from '@gamingalo/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMaintenance } from '../../maintenance';
import { browser, creator, startService, type TestService } from '../../test-support';

let service: TestService;

beforeEach(async () => {
  service = await startService();
});

afterEach(async () => {
  await service.close();
});

const codeOf = (response: { json(): unknown }) => errorResponseSchema.parse(response.json()).error.code;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

type Cli = Awaited<ReturnType<typeof creator>>['cli'];

const FILES: Record<string, string> = {
  'index.html': '<!doctype html><title>Game</title><script type="module" src="app.js"></script>',
  'app.js': 'console.log("hello")',
  'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
};

function manifestFor(version: string, files = FILES, gameId = 'my-game'): Manifest {
  return {
    gameId,
    version,
    entry: 'index.html',
    files: Object.entries(files).map(([path, content]) => ({ path, size: Buffer.byteLength(content), sha256: sha(content) })),
  };
}

async function setupGame() {
  const owner = await creator(service);
  const created = await owner.cli({ method: 'POST', url: '/v1/creator/games', payload: { id: 'my-game', title: 'My game' } });
  expect(created.statusCode).toBe(201);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const registered = await owner.cli({
    method: 'POST',
    url: '/v1/creator/games/my-game/keys',
    payload: { publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') },
  });
  expect(registered.statusCode).toBe(201);
  const keyId = (registered.json() as { id: string }).id;
  const signManifest = (manifest: Manifest) => sign(null, Buffer.from(canonicalManifest(manifest)), privateKey).toString('base64');
  return { ...owner, keyId, signManifest };
}

async function publish(cli: Cli, keyId: string, signManifest: (m: Manifest) => string, version: string, files = FILES) {
  const manifest = manifestFor(version, files);
  const started = await cli({
    method: 'POST',
    url: '/v1/creator/games/my-game/versions',
    payload: { manifest, keyId, signature: signManifest(manifest) },
  });
  expect(started.statusCode, started.body).toBe(201);
  const { missing } = uploadResponseSchema.parse(started.json());
  for (const [, content] of Object.entries(files)) {
    if (!missing.includes(sha(content))) continue;
    const put = await cli({
      method: 'PUT',
      url: `/v1/creator/games/my-game/versions/${version}/files/${sha(content)}`,
      payload: content,
      contentType: 'application/octet-stream',
    });
    expect(put.statusCode, put.body).toBe(204);
  }
  const done = await cli({ method: 'POST', url: `/v1/creator/games/my-game/versions/${version}/complete`, payload: {} });
  expect(done.statusCode, done.body).toBe(200);
  return missing;
}

const promote = (cli: Cli, version: string, channel = 'production') =>
  cli({ method: 'POST', url: `/v1/creator/games/my-game/channels/${channel}`, payload: { version } });

const fetchGame = (path: string, host = 'my-game.games.localhost:3001') =>
  service.games.inject({ url: path, headers: { host } });

describe('API tokens', () => {
  it('are shown once, stored as hashes, listed without the secret, and revocable', async () => {
    const owner = await creator(service);
    expect(owner.token).toMatch(/^gmg_/);
    const listed = await owner.client.get('/v1/me/tokens');
    expect(listed.body).not.toContain(owner.token);
    const { rows } = await service.database.query<{ token_hash: string }>('SELECT token_hash FROM api_tokens');
    expect(JSON.stringify(rows)).not.toContain(owner.token);

    const id = (listed.json() as { tokens: Array<{ id: string }> }).tokens[0]?.id;
    expect((await owner.client.delete(`/v1/me/tokens/${id}`)).statusCode).toBe(204);
    expect(codeOf(await owner.cli({ method: 'GET', url: '/v1/creator/games' }))).toBe('UNAUTHENTICATED');
  });

  it('need a registered account', async () => {
    const guest = browser(service);
    await guest.post('/v1/accounts/guest', { ageBand: '16plus' });
    expect(codeOf(await guest.post('/v1/me/tokens', { name: 'CI' }))).toBe('FORBIDDEN');
  });

  it('are only created from the web platform, not with another token', async () => {
    const owner = await creator(service);
    const response = await owner.cli({ method: 'POST', url: '/v1/me/tokens', payload: { name: 'x' } });
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('ignore cookies when a token is sent, so the two never mix', async () => {
    const owner = await creator(service);
    const response = await service.app.inject({
      method: 'GET',
      url: '/v1/creator/games',
      headers: { authorization: 'Bearer wrong', cookie: `gamingalo_session=${owner.client.jar.get('gamingalo_session')}` },
    });
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });
});

describe('games', () => {
  it('are created with unique IDs, and listed for their owner only', async () => {
    const { cli } = await setupGame();
    const games = (await cli({ method: 'GET', url: '/v1/creator/games' })).json() as { games: unknown[] };
    expect(gameResponseSchema.parse(games.games[0])).toMatchObject({
      id: 'my-game',
      productionVersion: null,
      url: 'http://my-game.games.localhost:3001/',
      previewUrl: 'http://preview--my-game.games.localhost:3001/',
    });

    const other = await creator(service);
    expect(((await other.cli({ method: 'GET', url: '/v1/creator/games' })).json() as { games: unknown[] }).games).toEqual([]);
    const taken = await other.cli({ method: 'POST', url: '/v1/creator/games', payload: { id: 'my-game', title: 'Mine' } });
    expect(codeOf(taken)).toBe('CONFLICT');
  });

  it("reports another creator's game as missing", async () => {
    await setupGame();
    const other = await creator(service);
    const response = await other.cli({ method: 'GET', url: '/v1/creator/games/my-game/versions' });
    expect(response.statusCode).toBe(404);
  });

  it('rejects invalid IDs and keys', async () => {
    const owner = await creator(service);
    expect(codeOf(await owner.cli({ method: 'POST', url: '/v1/creator/games', payload: { id: 'a--b', title: 'x' } }))).toBe(
      'INVALID_ARGUMENT',
    );
    await owner.cli({ method: 'POST', url: '/v1/creator/games', payload: { id: 'my-game', title: 'x' } });
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' });
    const response = await owner.cli({
      method: 'POST',
      url: '/v1/creator/games/my-game/keys',
      payload: { publicKey: rsa.toString('base64').slice(0, 200) },
    });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
  });
});

describe('publishing', () => {
  it('uploads a signed version, makes it live and lists it', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    const missing = await publish(cli, keyId, signManifest, '1.0.0');
    expect(missing).toHaveLength(3);

    const game = gameResponseSchema.parse((await promote(cli, '1.0.0')).json());
    expect(game.productionVersion).toBe('1.0.0');

    const { versions } = versionListResponseSchema.parse(
      (await cli({ method: 'GET', url: '/v1/creator/games/my-game/versions' })).json(),
    );
    expect(versions[0]).toMatchObject({ version: '1.0.0', status: 'ready', channels: ['production'], fileCount: 3 });
  });

  it('only asks for files it does not already have', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    const missing = await publish(cli, keyId, signManifest, '1.0.1', { ...FILES, 'app.js': 'console.log("v2")' });
    expect(missing).toEqual([sha('console.log("v2")')]);
  });

  it('refuses a bad signature, or a key from another game', async () => {
    const { cli, keyId } = await setupGame();
    const manifest = manifestFor('1.0.0');
    const other = generateKeyPairSync('ed25519').privateKey;
    const forged = sign(null, Buffer.from(canonicalManifest(manifest)), other).toString('base64');
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: forged } });
    expect(response.statusCode).toBe(403);
    expect(codeOf(response)).toBe('FORBIDDEN');
  });

  it('refuses a manifest changed after signing', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    const manifest = manifestFor('1.0.0');
    const signature = signManifest(manifest);
    const tampered = { ...manifest, files: [...manifest.files, { path: 'extra.js', size: 1, sha256: sha('x') }] };
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest: tampered, keyId, signature } });
    expect(codeOf(response)).toBe('FORBIDDEN');
  });

  it('refuses a file whose content does not match the manifest', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    const manifest = manifestFor('1.0.0');
    await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: signManifest(manifest) } });

    const response = await cli({
      method: 'PUT',
      url: `/v1/creator/games/my-game/versions/1.0.0/files/${sha(FILES['app.js'] as string)}`,
      payload: 'alert("swapped")',
      contentType: 'application/octet-stream',
    });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
    expect(await service.store.has(sha('alert("swapped")'))).toBe(false);
  });

  it('refuses to complete until every file is uploaded', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    const manifest = manifestFor('1.0.0');
    await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: signManifest(manifest) } });
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions/1.0.0/complete', payload: {} });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
    expect(codeOf(await promote(cli, '1.0.0'))).toBe('NOT_FOUND');
  });

  it('never changes a published version', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    const manifest = manifestFor('1.0.0', { ...FILES, 'app.js': 'changed' });
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: signManifest(manifest) } });
    expect(codeOf(response)).toBe('CONFLICT');
  });

  it.each([
    ['a path outside the game', '../escape.js'],
    ['an executable', 'tool.exe'],
    ['a hidden file', '.secret.json'],
  ])('refuses %s', async (_name, path) => {
    const { cli, keyId, signManifest } = await setupGame();
    const manifest = { ...manifestFor('1.0.0'), files: [...manifestFor('1.0.0').files, { path, size: 1, sha256: sha('x') }] };
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: signManifest(manifest as Manifest) } });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
  });

  it('enforces size limits', async () => {
    await service.close();
    service = await startService({ MAX_VERSION_BYTES: '50' });
    const { cli, keyId, signManifest } = await setupGame();
    const manifest = manifestFor('1.0.0');
    const response = await cli({ method: 'POST', url: '/v1/creator/games/my-game/versions', payload: { manifest, keyId, signature: signManifest(manifest) } });
    expect(codeOf(response)).toBe('INVALID_ARGUMENT');
  });
});

describe('serving', () => {
  it('serves the live version from the game origin, with strict security headers', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    await promote(cli, '1.0.0');

    const page = await fetchGame('/');
    expect(page.statusCode).toBe(200);
    expect(page.body).toBe(FILES['index.html']);
    expect(page.headers['content-type']).toContain('text/html');
    const csp = page.headers['content-security-policy'] as string;
    expect(csp).toContain(`frame-ancestors ${service.config.webOrigin}`);
    expect(csp).toContain(`connect-src 'self' ${service.config.apiOrigin}`);
    expect(csp).toContain("object-src 'none'");
    expect(page.headers['x-content-type-options']).toBe('nosniff');

    expect((await fetchGame('/assets/logo.svg')).headers['content-type']).toBe('image/svg+xml');
    expect((await fetchGame('/missing.js')).statusCode).toBe(404);
  });

  it('answers conditional requests', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    await promote(cli, '1.0.0');
    const first = await fetchGame('/app.js');
    const again = await service.games.inject({
      url: '/app.js',
      headers: { host: 'my-game.games.localhost:3001', 'if-none-match': first.headers.etag as string },
    });
    expect(again.statusCode).toBe(304);
  });

  it('serves nothing before a version is live, or for unknown hosts and games', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    expect((await fetchGame('/')).statusCode).toBe(404);
    expect((await fetchGame('/', 'other-game.games.localhost:3001')).statusCode).toBe(404);
    expect((await fetchGame('/', 'localhost:3001')).statusCode).toBe(404);
    expect((await fetchGame('/', 'a.b.games.localhost:3001')).statusCode).toBe(404);
  });

  it('keeps preview and production separate, and rolls back', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    await publish(cli, keyId, signManifest, '2.0.0', { ...FILES, 'index.html': '<p>v2</p>' });
    await promote(cli, '1.0.0');
    await promote(cli, '2.0.0', 'preview');

    expect((await fetchGame('/')).body).toBe(FILES['index.html']);
    expect((await fetchGame('/', 'preview--my-game.games.localhost:3001')).body).toBe('<p>v2</p>');

    await promote(cli, '2.0.0');
    expect((await fetchGame('/')).body).toBe('<p>v2</p>');
    await promote(cli, '1.0.0');
    expect((await fetchGame('/')).body).toBe(FILES['index.html']);
  });

  it('lists live games in the public catalog only', async () => {
    const { cli, keyId, signManifest } = await setupGame();
    expect(catalogResponseSchema.parse((await browser(service).get('/v1/catalog')).json()).games).toEqual([]);
    await publish(cli, keyId, signManifest, '1.0.0');
    await promote(cli, '1.0.0');
    const { games } = catalogResponseSchema.parse((await browser(service).get('/v1/catalog')).json());
    expect(games).toEqual([{ id: 'my-game', title: 'My game', url: 'http://my-game.games.localhost:3001/' }]);
    expect((await browser(service).get('/v1/games/my-game')).statusCode).toBe(200);
  });
});

describe('play tokens and the game API', () => {
  async function playing() {
    const { cli, keyId, signManifest } = await setupGame();
    await publish(cli, keyId, signManifest, '1.0.0');
    await promote(cli, '1.0.0');
    const player = browser(service);
    await player.post('/v1/accounts/guest', { ageBand: '13to15' });
    await player.patch('/v1/me', { displayName: 'Ada' });
    return { player };
  }

  const gameOrigin = 'http://my-game.games.localhost:3001';
  const me = (token: string, origin = gameOrigin) =>
    service.app.inject({ url: '/v1/game/me', headers: { authorization: `Bearer ${token}`, origin } });

  it('lets a game read a limited profile with a play token, from its own origin', async () => {
    const { player } = await playing();
    const issued = playTokenResponseSchema.parse((await player.post('/v1/games/my-game/play-token')).json());
    expect(issued.apiOrigin).toBe(service.config.apiOrigin);

    const response = await me(issued.token);
    const profile = playerProfileSchema.parse(response.json());
    expect(profile).toMatchObject({ displayName: 'Ada', minor: true, guest: true });
    expect(response.headers['access-control-allow-origin']).toBe(gameOrigin);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('gives each game a different player ID for the same account', async () => {
    const { player } = await playing();
    const owner = await creator(service);
    await owner.cli({ method: 'POST', url: '/v1/creator/games', payload: { id: 'other-game', title: 'Other' } });

    const first = playTokenResponseSchema.parse((await player.post('/v1/games/my-game/play-token')).json());
    const second = playTokenResponseSchema.parse((await player.post('/v1/games/other-game/play-token')).json());
    const again = playTokenResponseSchema.parse((await player.post('/v1/games/my-game/play-token')).json());

    const idOf = async (token: string) => playerProfileSchema.parse((await me(token)).json()).playerId;
    expect(await idOf(first.token)).not.toBe(await idOf(second.token));
    expect(await idOf(first.token)).toBe(await idOf(again.token));
  });

  it('refuses expired and unknown tokens, and other origins get no CORS access', async () => {
    const { player } = await playing();
    const issued = playTokenResponseSchema.parse((await player.post('/v1/games/my-game/play-token')).json());
    expect((await me(issued.token, 'https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect(codeOf(await me('gmp_unknown'))).toBe('UNAUTHENTICATED');
    await service.database.query("UPDATE play_tokens SET expires_at = now() - interval '1 second'");
    expect(codeOf(await me(issued.token))).toBe('UNAUTHENTICATED');
  });

  it('needs a signed-in player, and a real game', async () => {
    await playing();
    expect(codeOf(await browser(service).post('/v1/games/my-game/play-token'))).toBe('UNAUTHENTICATED');
    const player = browser(service);
    await player.post('/v1/accounts/guest', { ageBand: '16plus' });
    expect(codeOf(await player.post('/v1/games/nope/play-token'))).toBe('NOT_FOUND');
  });

  it('does not accept a play token as an API token, or the other way round', async () => {
    const { player } = await playing();
    const issued = playTokenResponseSchema.parse((await player.post('/v1/games/my-game/play-token')).json());
    const asApi = await service.app.inject({ url: '/v1/creator/games', headers: { authorization: `Bearer ${issued.token}` } });
    expect(codeOf(asApi)).toBe('UNAUTHENTICATED');
    const owner = await creator(service);
    expect(codeOf(await me(owner.token))).toBe('UNAUTHENTICATED');
  });
});

describe('maintenance', () => {
  it('removes expired sessions and tokens, and abandoned guests only', async () => {
    const owner = await setupGame();
    const keep = browser(service);
    await keep.post('/v1/accounts/guest', { ageBand: '16plus' });
    const abandoned = browser(service);
    await abandoned.post('/v1/accounts/guest', { ageBand: '16plus' });
    const { rows } = await service.database.query<{ id: string }>(
      "SELECT a.id FROM accounts a JOIN sessions s ON s.account_id = a.id WHERE a.kind = 'guest' ORDER BY a.created_at DESC LIMIT 1",
    );
    const abandonedId = (rows[0] as { id: string }).id;
    await service.database.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE account_id = $1", [abandonedId]);
    await service.database.query("UPDATE accounts SET created_at = now() - interval '31 days' WHERE kind = 'guest'");
    await service.database.query("UPDATE accounts SET created_at = now() - interval '31 days' WHERE id = $1", [owner.accountId]);

    const result = await runMaintenance(service.database, 30);

    expect(result).toMatchObject({ sessions: 1, guests: 1 });
    expect((await keep.get('/v1/me')).statusCode).toBe(200);
    expect((await owner.client.get('/v1/me')).statusCode).toBe(200);
    expect((await service.database.query('SELECT 1 FROM accounts WHERE id = $1', [abandonedId])).rows).toEqual([]);
  });
});
