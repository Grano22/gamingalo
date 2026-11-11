import { createHash, createPublicKey, verify } from 'node:crypto';
import {
  canonicalManifest,
  catalogResponseSchema,
  channelSchema,
  createGameRequestSchema,
  createUploadRequestSchema,
  gameIdSchema,
  gameResponseSchema,
  playTokenResponseSchema,
  promoteRequestSchema,
  publicGameSchema,
  registerKeyRequestSchema,
  semverSchema,
  sha256Schema,
  signingKeyResponseSchema,
  uploadResponseSchema,
  versionListResponseSchema,
} from '@gamingalo/contracts';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import type { Database, Queryable } from '../../db/database';
import { fail, parseBody } from '../../errors';
import { requireCreator } from '../../auth/creators';
import { hashToken, requireSession } from '../../auth/sessions';
import { describeGame, gameUrl, type GameRow } from '../../hosting';
import type { BlobStore } from '../../storage/blob-store';

const PLAY_TOKEN_MINUTES = 15;

const GAME_COLUMNS = 'id, title, production_version, preview_version, created_at';

function parseParam<T>(schema: { safeParse(value: unknown): { success: boolean; data?: T } }, value: unknown, name: string): T {
  const result = schema.safeParse(value);
  // A malformed ID can't match anything, so it's reported as missing.
  if (!result.success) throw fail('NOT_FOUND', `There is no such ${name}.`);
  return result.data as T;
}

/** Returns the game if this account owns it. Other people's games are reported as missing. */
async function ownedGame(db: Queryable, gameId: string, accountId: string): Promise<GameRow> {
  const { rows } = await db.query<GameRow>(`SELECT ${GAME_COLUMNS} FROM games WHERE id = $1 AND owner_id = $2`, [
    gameId,
    accountId,
  ]);
  const game = rows[0];
  if (!game) throw fail('NOT_FOUND', 'There is no such game.');
  return game;
}

function verifySignature(publicKey: string, manifest: string, signature: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(manifest), key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

export function registerGameRoutes(app: FastifyInstance, database: Database, config: Config, store: BlobStore): void {
  // Raw file bodies for uploads, limited per file rather than by the general body limit.
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: config.maxFileBytes }, (_request, body, done) =>
    done(null, body),
  );

  app.get('/v1/catalog', async () => {
    const { rows } = await database.query<GameRow>(
      `SELECT ${GAME_COLUMNS} FROM games WHERE production_version IS NOT NULL ORDER BY created_at DESC LIMIT 100`,
    );
    return catalogResponseSchema.parse({
      games: rows.map((row) => ({ id: row.id, title: row.title, url: gameUrl(config, row.id) })),
    });
  });

  app.get<{ Params: { gameId: string } }>('/v1/games/:gameId', async (request) => {
    const gameId = parseParam(gameIdSchema, request.params.gameId, 'game');
    const { rows } = await database.query<GameRow>(
      `SELECT ${GAME_COLUMNS} FROM games WHERE id = $1 AND production_version IS NOT NULL`,
      [gameId],
    );
    const game = rows[0];
    if (!game) throw fail('NOT_FOUND', 'There is no such game.');
    return publicGameSchema.parse({ id: game.id, title: game.title, url: gameUrl(config, game.id) });
  });

  app.get('/v1/creator/games', async (request, reply) => {
    const creator = await requireCreator(database, request, reply, config);
    const { rows } = await database.query<GameRow>(
      `SELECT ${GAME_COLUMNS} FROM games WHERE owner_id = $1 ORDER BY created_at`,
      [creator.accountId],
    );
    return { games: rows.map((row) => gameResponseSchema.parse(describeGame(config, row))) };
  });

  app.post('/v1/creator/games', async (request, reply) => {
    const creator = await requireCreator(database, request, reply, config);
    const { id, title } = parseBody(createGameRequestSchema, request.body);
    const { rows } = await database.query<GameRow>(
      `INSERT INTO games (id, owner_id, title) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING ${GAME_COLUMNS}`,
      [id, creator.accountId, title],
    );
    const game = rows[0];
    if (!game) throw fail('CONFLICT', 'This game ID is taken.');
    void reply.status(201);
    return gameResponseSchema.parse(describeGame(config, game));
  });

  app.post<{ Params: { gameId: string } }>('/v1/creator/games/:gameId/keys', async (request, reply) => {
    const creator = await requireCreator(database, request, reply, config);
    const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
    const { publicKey } = parseBody(registerKeyRequestSchema, request.body);
    try {
      const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
      if (key.asymmetricKeyType !== 'ed25519') throw new Error('Not Ed25519');
    } catch {
      throw fail('INVALID_ARGUMENT', 'The public key must be an Ed25519 key in base64 DER (SPKI) format.');
    }
    const { rows } = await database.query<{ id: string; created_at: Date }>(
      'INSERT INTO signing_keys (game_id, public_key) VALUES ($1, $2) RETURNING id, created_at',
      [game.id, publicKey],
    );
    const row = rows[0] as { id: string; created_at: Date };
    void reply.status(201);
    return signingKeyResponseSchema.parse({ id: row.id, createdAt: new Date(row.created_at).toISOString() });
  });

  app.get<{ Params: { gameId: string } }>('/v1/creator/games/:gameId/versions', async (request, reply) => {
    const creator = await requireCreator(database, request, reply, config);
    const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
    const { rows } = await database.query<{
      version: string;
      status: 'uploading' | 'ready';
      file_count: number;
      total_bytes: string | number;
      created_at: Date;
    }>(
      'SELECT version, status, file_count, total_bytes, created_at FROM game_versions WHERE game_id = $1 ORDER BY created_at DESC',
      [game.id],
    );
    return versionListResponseSchema.parse({
      versions: rows.map((row) => ({
        version: row.version,
        status: row.status,
        channels: [
          ...(game.production_version === row.version ? ['production' as const] : []),
          ...(game.preview_version === row.version ? ['preview' as const] : []),
        ],
        fileCount: row.file_count,
        totalBytes: Number(row.total_bytes),
        createdAt: new Date(row.created_at).toISOString(),
      })),
    });
  });

  /** Starts a version from a signed manifest, and reports which files the server still needs. */
  app.post<{ Params: { gameId: string } }>('/v1/creator/games/:gameId/versions', async (request, reply) => {
    const creator = await requireCreator(database, request, reply, config);
    const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
    const { manifest, keyId, signature } = parseBody(createUploadRequestSchema, request.body);
    if (manifest.gameId !== game.id) throw fail('INVALID_ARGUMENT', 'The manifest is for a different game.');

    const totalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0);
    if (manifest.files.some((file) => file.size > config.maxFileBytes)) {
      throw fail('INVALID_ARGUMENT', `Each file must be at most ${config.maxFileBytes} bytes.`);
    }
    if (totalBytes > config.maxVersionBytes) {
      throw fail('INVALID_ARGUMENT', `A version must be at most ${config.maxVersionBytes} bytes in total.`);
    }

    const { rows: keys } = await database.query<{ public_key: string }>(
      'SELECT public_key FROM signing_keys WHERE id = $1 AND game_id = $2 AND revoked_at IS NULL',
      [keyId, game.id],
    );
    const key = keys[0];
    if (!key || !verifySignature(key.public_key, canonicalManifest(manifest), signature)) {
      throw fail('FORBIDDEN', "The manifest's signature doesn't match a registered key for this game.");
    }

    await database.transaction(async (tx) => {
      const { rows: existing } = await tx.query<{ status: string; manifest_signature: string }>(
        'SELECT status, manifest_signature FROM game_versions WHERE game_id = $1 AND version = $2 FOR UPDATE',
        [game.id, manifest.version],
      );
      const previous = existing[0];
      if (previous?.status === 'ready') throw fail('CONFLICT', 'This version is already published. Versions never change.');
      if (previous) {
        // An unfinished upload can be resumed, or restarted with a new manifest.
        await tx.query('DELETE FROM game_versions WHERE game_id = $1 AND version = $2', [game.id, manifest.version]);
      }
      await tx.query(
        `INSERT INTO game_versions (game_id, version, entry, manifest_signature, signing_key_id, status, total_bytes, file_count)
         VALUES ($1, $2, $3, $4, $5, 'uploading', $6, $7)`,
        [game.id, manifest.version, manifest.entry, signature, keyId, totalBytes, manifest.files.length],
      );
      for (const file of manifest.files) {
        await tx.query('INSERT INTO game_files (game_id, version, path, sha256, size) VALUES ($1, $2, $3, $4, $5)', [
          game.id,
          manifest.version,
          file.path,
          file.sha256,
          file.size,
        ]);
      }
    });

    const missing: string[] = [];
    for (const hash of new Set(manifest.files.map((file) => file.sha256))) {
      if (!(await store.has(hash))) missing.push(hash);
    }
    void reply.status(201);
    return uploadResponseSchema.parse({ version: manifest.version, missing });
  });

  /** Accepts a file only if its content matches a hash in the signed manifest. */
  app.put<{ Params: { gameId: string; version: string; sha256: string } }>(
    '/v1/creator/games/:gameId/versions/:version/files/:sha256',
    async (request, reply) => {
      const creator = await requireCreator(database, request, reply, config);
      const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
      const version = parseParam(semverSchema, request.params.version, 'version');
      const sha256 = parseParam(sha256Schema, request.params.sha256, 'file');
      if (!Buffer.isBuffer(request.body)) throw fail('INVALID_ARGUMENT', 'Send the file as application/octet-stream.');

      const { rows } = await database.query<{ size: string | number }>(
        `SELECT f.size FROM game_files f JOIN game_versions v USING (game_id, version)
          WHERE f.game_id = $1 AND f.version = $2 AND f.sha256 = $3 AND v.status = 'uploading' LIMIT 1`,
        [game.id, version, sha256],
      );
      const expected = rows[0];
      if (!expected) throw fail('NOT_FOUND', 'This file is not part of an unfinished upload.');

      const body = request.body;
      const actual = createHash('sha256').update(body).digest('hex');
      if (actual !== sha256 || body.length !== Number(expected.size)) {
        throw fail('INVALID_ARGUMENT', "The file's content doesn't match the signed manifest.");
      }
      await store.put(sha256, new Uint8Array(body));
      void reply.status(204);
      return null;
    },
  );

  app.post<{ Params: { gameId: string; version: string } }>(
    '/v1/creator/games/:gameId/versions/:version/complete',
    async (request, reply) => {
      const creator = await requireCreator(database, request, reply, config);
      const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
      const version = parseParam(semverSchema, request.params.version, 'version');
      const { rows } = await database.query<{ sha256: string }>(
        `SELECT DISTINCT f.sha256 FROM game_files f JOIN game_versions v USING (game_id, version)
          WHERE f.game_id = $1 AND f.version = $2 AND v.status = 'uploading'`,
        [game.id, version],
      );
      if (rows.length === 0) throw fail('NOT_FOUND', 'There is no unfinished upload for this version.');
      const missing: string[] = [];
      for (const row of rows) if (!(await store.has(row.sha256))) missing.push(row.sha256);
      if (missing.length > 0) throw fail('INVALID_ARGUMENT', `${missing.length} files have not been uploaded yet.`);
      await database.query("UPDATE game_versions SET status = 'ready' WHERE game_id = $1 AND version = $2", [game.id, version]);
      return { version, status: 'ready' };
    },
  );

  /** Makes a ready version live on a channel. Promoting an older version is a rollback. */
  app.post<{ Params: { gameId: string; channel: string } }>(
    '/v1/creator/games/:gameId/channels/:channel',
    async (request, reply) => {
      const creator = await requireCreator(database, request, reply, config);
      const game = await ownedGame(database, parseParam(gameIdSchema, request.params.gameId, 'game'), creator.accountId);
      const channel = parseParam(channelSchema, request.params.channel, 'channel');
      const { version } = parseBody(promoteRequestSchema, request.body);
      const { rows } = await database.query(
        "SELECT 1 FROM game_versions WHERE game_id = $1 AND version = $2 AND status = 'ready'",
        [game.id, version],
      );
      if (rows.length === 0) throw fail('NOT_FOUND', 'There is no finished upload for this version.');
      const column = channel === 'production' ? 'production_version' : 'preview_version';
      const { rows: updated } = await database.query<GameRow>(
        `UPDATE games SET ${column} = $2 WHERE id = $1 RETURNING ${GAME_COLUMNS}`,
        [game.id, version],
      );
      return gameResponseSchema.parse(describeGame(config, updated[0] as GameRow));
    },
  );

  /** A short-lived token the platform hands to a game, so the game can act for the player, for itself only. */
  app.post<{ Params: { gameId: string } }>('/v1/games/:gameId/play-token', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const gameId = parseParam(gameIdSchema, request.params.gameId, 'game');
    const { rows } = await database.query('SELECT 1 FROM games WHERE id = $1', [gameId]);
    if (rows.length === 0) throw fail('NOT_FOUND', 'There is no such game.');

    const token = `gmp_${randomBytes(32).toString('base64url')}`;
    await database.query('DELETE FROM play_tokens WHERE expires_at < now()');
    await database.query(
      'INSERT INTO players (account_id, game_id) VALUES ($1, $2) ON CONFLICT (account_id, game_id) DO NOTHING',
      [session.accountId, gameId],
    );
    const { rows: inserted } = await database.query<{ expires_at: Date }>(
      `INSERT INTO play_tokens (token_hash, account_id, game_id, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING expires_at`,
      [hashToken(token), session.accountId, gameId, PLAY_TOKEN_MINUTES],
    );
    return playTokenResponseSchema.parse({
      token,
      expiresAt: new Date((inserted[0] as { expires_at: Date }).expires_at).toISOString(),
      apiOrigin: config.apiOrigin,
    });
  });
}
