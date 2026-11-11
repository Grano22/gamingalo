import * as z from 'zod';

/** Lowercase letters, digits and single hyphens. `--` is reserved for preview addresses. */
export const gameIdSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9]|-(?!-)){1,38}[a-z0-9]$/, 'Use 3 to 40 lowercase letters, digits and single hyphens.');

export const semverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/, 'Use a semantic version such as 1.0.0.');

export const channelSchema = z.enum(['production', 'preview']);
export type Channel = z.infer<typeof channelSchema>;

/** File types a game may contain. Anything else, such as executables, is refused. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  bin: 'application/octet-stream',
  ktx2: 'image/ktx2',
  data: 'application/octet-stream',
  pck: 'application/octet-stream',
});

/** Returns the content type for a path, or `undefined` if that file type isn't allowed. */
export function contentTypeFor(path: string): string | undefined {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return undefined;
  const extension = path.slice(dot + 1).toLowerCase();
  return Object.hasOwn(CONTENT_TYPES, extension) ? CONTENT_TYPES[extension] : undefined;
}

/** Relative paths with simple segments. No `..`, hidden files, backslashes or empty segments. */
export const filePathSchema = z
  .string()
  .max(200)
  .regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/, 'Use simple relative paths.')
  .refine((path) => !path.split('/').some((segment) => segment === '..' || segment === '.'), 'Use simple relative paths.')
  .refine((path) => contentTypeFor(path) !== undefined, 'This file type is not allowed.');

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'Expected a SHA-256 hash in lowercase hex.');

export const budgetsSchema = z.strictObject({
  maxTotalBytes: z.number().int().positive().optional(),
  maxFileBytes: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
});

/** `gamingalo.json`, which describes a game for the CLI. */
export const gameConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  id: gameIdSchema,
  title: z.string().trim().min(1).max(60),
  version: semverSchema,
  /** The folder to publish, relative to `gamingalo.json`. */
  dir: z.string().min(1).default('dist'),
  /** The page that starts the game, relative to `dir`. */
  entry: filePathSchema.default('index.html'),
  budgets: budgetsSchema.optional(),
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

export const manifestFileSchema = z.strictObject({
  path: filePathSchema,
  size: z.number().int().nonnegative(),
  sha256: sha256Schema,
});

export const manifestSchema = z
  .strictObject({
    gameId: gameIdSchema,
    version: semverSchema,
    entry: filePathSchema,
    files: z.array(manifestFileSchema).min(1).max(10000),
  })
  .refine((manifest) => new Set(manifest.files.map((file) => file.path)).size === manifest.files.length, 'Each path must be listed once.')
  .refine((manifest) => manifest.files.some((file) => file.path === manifest.entry), 'The entry file must be included.');
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * The exact bytes that are signed: keys in a fixed order and files sorted by path, so that the
 * CLI and the server always agree.
 */
export function canonicalManifest(manifest: Manifest): string {
  const files = [...manifest.files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((file) => ({ path: file.path, size: file.size, sha256: file.sha256 }));
  return JSON.stringify({ gameId: manifest.gameId, version: manifest.version, entry: manifest.entry, files });
}

export const createGameRequestSchema = z.strictObject({ id: gameIdSchema, title: z.string().trim().min(1).max(60) });

export const gameResponseSchema = z.strictObject({
  id: gameIdSchema,
  title: z.string(),
  productionVersion: semverSchema.nullable(),
  previewVersion: semverSchema.nullable(),
  url: z.url(),
  previewUrl: z.url(),
  createdAt: z.iso.datetime(),
});
export type GameResponse = z.infer<typeof gameResponseSchema>;

export const publicGameSchema = z.strictObject({ id: gameIdSchema, title: z.string(), url: z.url() });
export type PublicGame = z.infer<typeof publicGameSchema>;
export const catalogResponseSchema = z.strictObject({ games: z.array(publicGameSchema) });

export const versionResponseSchema = z.strictObject({
  version: semverSchema,
  status: z.enum(['uploading', 'ready']),
  channels: z.array(channelSchema),
  fileCount: z.number().int(),
  totalBytes: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;
export const versionListResponseSchema = z.strictObject({ versions: z.array(versionResponseSchema) });

/** An Ed25519 public key, as base64 DER (SPKI). */
export const registerKeyRequestSchema = z.strictObject({ publicKey: z.string().min(40).max(200) });
export const signingKeyResponseSchema = z.strictObject({ id: z.uuid(), createdAt: z.iso.datetime() });

export const createUploadRequestSchema = z.strictObject({
  manifest: manifestSchema,
  keyId: z.uuid(),
  /** Ed25519 signature of `canonicalManifest(manifest)`, as base64. */
  signature: z.string().min(1).max(200),
});
export const uploadResponseSchema = z.strictObject({
  version: semverSchema,
  /** Hashes of files the server doesn't have yet. Identical files from any version are reused. */
  missing: z.array(sha256Schema),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const promoteRequestSchema = z.strictObject({ version: semverSchema });

export const createApiTokenRequestSchema = z.strictObject({ name: z.string().trim().min(1).max(60) });
export const apiTokenSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;
/** The token itself is only ever shown once, when it's created. */
export const createdApiTokenSchema = z.strictObject({ ...apiTokenSchema.shape, token: z.string() });
export const apiTokenListSchema = z.strictObject({ tokens: z.array(apiTokenSchema) });

/** A short-lived token that lets a game act for the player, and for this game only. */
export const playTokenResponseSchema = z.strictObject({ token: z.string(), expiresAt: z.iso.datetime(), apiOrigin: z.url() });
export type PlayTokenResponse = z.infer<typeof playTokenResponseSchema>;

/** What a game learns about its player. The ID is different for each game, so games can't link players. */
export const playerProfileSchema = z.strictObject({
  playerId: z.uuid(),
  displayName: z.string(),
  minor: z.boolean(),
  guest: z.boolean(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
