import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as z from 'zod';
import { CliError } from './errors';

const credentialsSchema = z.strictObject({ apiUrl: z.url(), token: z.string().min(1) });
export type Credentials = z.infer<typeof credentialsSchema>;

export const DEFAULT_API_URL = 'https://api.gamingalo.example';

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env['GAMINGALO_CONFIG_DIR']) return env['GAMINGALO_CONFIG_DIR'];
  return join(env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), 'gamingalo');
}

/** Writes a file only the current user can read, because it holds a secret. */
export async function writePrivateFile(path: string, content: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true, mode: 0o700 });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function saveCredentials(credentials: Credentials, env = process.env): Promise<string> {
  const path = join(configDir(env), 'credentials.json');
  await writePrivateFile(path, `${JSON.stringify(credentialsSchema.parse(credentials), null, 2)}\n`);
  return path;
}

export async function removeCredentials(env = process.env): Promise<void> {
  await rm(join(configDir(env), 'credentials.json'), { force: true });
}

/** Environment variables win, so CI never needs a credentials file. */
export async function loadCredentials(env = process.env): Promise<Credentials> {
  const fromFile = await readFile(join(configDir(env), 'credentials.json'), 'utf8')
    .then((text) => credentialsSchema.partial().parse(JSON.parse(text)))
    .catch(() => ({}) as Partial<Credentials>);
  const token = env['GAMINGALO_TOKEN'] || fromFile.token;
  const apiUrl = env['GAMINGALO_API_URL'] || fromFile.apiUrl || DEFAULT_API_URL;
  if (!token) throw new CliError('Not signed in. Run `gamingalo login --token-stdin`, or set GAMINGALO_TOKEN.');
  return { token, apiUrl };
}

export interface SigningKey {
  keyId: string;
  privateKeyPem: string;
}

const keyInfoSchema = z.strictObject({ keyId: z.uuid() });

export function keyPaths(gameId: string, env = process.env): { pem: string; info: string } {
  const dir = join(configDir(env), 'keys');
  return { pem: join(dir, `${gameId}.pem`), info: join(dir, `${gameId}.json`) };
}

/** From GAMINGALO_SIGNING_KEY and GAMINGALO_SIGNING_KEY_ID in CI, or from the files `game:keys:create` writes. */
export async function loadSigningKey(gameId: string, env = process.env): Promise<SigningKey> {
  if (env['GAMINGALO_SIGNING_KEY'] && env['GAMINGALO_SIGNING_KEY_ID']) {
    return { privateKeyPem: env['GAMINGALO_SIGNING_KEY'], keyId: env['GAMINGALO_SIGNING_KEY_ID'] };
  }
  const paths = keyPaths(gameId, env);
  try {
    const [privateKeyPem, info] = await Promise.all([readFile(paths.pem, 'utf8'), readFile(paths.info, 'utf8')]);
    return { privateKeyPem, keyId: keyInfoSchema.parse(JSON.parse(info)).keyId };
  } catch {
    throw new CliError(
      `No signing key for ${gameId}. Run \`gamingalo game:keys:create\`, or set GAMINGALO_SIGNING_KEY and GAMINGALO_SIGNING_KEY_ID.`,
    );
  }
}
