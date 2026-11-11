import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  canonicalManifest,
  gameResponseSchema,
  signingKeyResponseSchema,
  uploadResponseSchema,
  versionListResponseSchema,
  type Channel,
} from '@gamingalo/contracts';
import { createApiClient } from './api';
import { createProject, DEFAULT_TEMPLATE } from './create';
import { CliError } from './errors';
import { buildManifest, loadProject } from './project';
import { keyPaths, loadCredentials, loadSigningKey, removeCredentials, saveCredentials, writePrivateFile, DEFAULT_API_URL } from './settings';

export interface Output {
  info(message: string): void;
  warn(message: string): void;
}

export interface Runtime {
  env: NodeJS.ProcessEnv;
  output: Output;
  fetch: typeof fetch;
  readStdin(): Promise<string>;
}

async function client(runtime: Runtime) {
  return createApiClient(await loadCredentials(runtime.env), runtime.fetch);
}

export async function login(runtime: Runtime, options: { apiUrl?: string; tokenStdin?: boolean; token?: string }) {
  if (options.token) runtime.output.warn('A token on the command line can end up in your shell history. Prefer --token-stdin.');
  const token = (options.token ?? (options.tokenStdin ? await runtime.readStdin() : '')).trim();
  if (!token) throw new CliError('Pass a token with --token-stdin. Create one in your Gamingalo creator settings.');
  const apiUrl = options.apiUrl ?? runtime.env['GAMINGALO_API_URL'] ?? DEFAULT_API_URL;
  const api = createApiClient({ apiUrl, token }, runtime.fetch);
  await api.get('/v1/creator/games');
  const path = await saveCredentials({ apiUrl, token }, runtime.env);
  runtime.output.info(`Signed in. Credentials saved to ${path}, readable only by you.`);
}

export async function create(
  runtime: Runtime,
  directory: string,
  options: { template?: string; ref?: string; id?: string; title?: string; git: boolean },
) {
  const template = options.template ?? runtime.env['GAMINGALO_TEMPLATE'] ?? DEFAULT_TEMPLATE;
  const project = await createProject({ directory, template, git: options.git, ...pick(options) });
  runtime.output.info(`Created ${project.title} (${project.id}) in ${project.root}.`);
  runtime.output.info('Next: cd into it, then run npm install and npm run dev. AI agents start from AGENTS.md.');
}

function pick(options: { ref?: string; id?: string; title?: string }) {
  return {
    ...(options.ref ? { ref: options.ref } : {}),
    ...(options.id ? { id: options.id } : {}),
    ...(options.title ? { title: options.title } : {}),
  };
}

export async function logout(runtime: Runtime) {
  await removeCredentials(runtime.env);
  runtime.output.info('Signed out on this computer. Revoke the token in your creator settings if it may have leaked.');
}

export async function createGame(runtime: Runtime, directory: string) {
  const project = await loadProject(directory);
  const api = await client(runtime);
  const game = gameResponseSchema.parse(await api.post('/v1/creator/games', { id: project.config.id, title: project.config.title }));
  runtime.output.info(`Created ${game.id}. It will be served at ${game.url}`);
}

export async function createKey(runtime: Runtime, directory: string) {
  const { config } = await loadProject(directory);
  const paths = keyPaths(config.id, runtime.env);
  const existing = await readFile(paths.pem, 'utf8').catch(() => undefined);
  if (existing) throw new CliError(`A signing key for ${config.id} already exists at ${paths.pem}.`);

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const api = await client(runtime);
  const registered = signingKeyResponseSchema.parse(
    await api.post(`/v1/creator/games/${config.id}/keys`, {
      publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    }),
  );
  await writePrivateFile(paths.pem, privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
  await writeFile(paths.info, `${JSON.stringify({ keyId: registered.id }, null, 2)}\n`);
  runtime.output.info(`Created signing key ${registered.id}. The private key is at ${paths.pem}. Keep it secret, and back it up.`);
}

export async function validate(runtime: Runtime, directory: string): Promise<boolean> {
  const project = await loadProject(directory);
  for (const skipped of project.skipped) runtime.output.warn(`Skipped ${skipped}`);
  if (project.problems.length > 0) {
    for (const problem of project.problems) runtime.output.warn(problem);
    return false;
  }
  runtime.output.info(`${project.config.id} ${project.config.version}: ${project.files.length} files, ${project.totalBytes} bytes. Ready to publish.`);
  return true;
}

export async function publish(runtime: Runtime, directory: string, options: { channel: Channel }) {
  const project = await loadProject(directory);
  for (const skipped of project.skipped) runtime.output.warn(`Skipped ${skipped}`);
  if (project.problems.length > 0) {
    throw new CliError(`The game can't be published:\n${project.problems.map((problem) => `  ${problem}`).join('\n')}`);
  }

  const api = await client(runtime);
  await api.checkCompatibility();
  const key = await loadSigningKey(project.config.id, runtime.env);
  const manifest = buildManifest(project);
  let signature: string;
  try {
    signature = sign(null, Buffer.from(canonicalManifest(manifest)), createPrivateKey(key.privateKeyPem)).toString('base64');
  } catch {
    throw new CliError('The signing key could not be read. It must be an Ed25519 private key in PEM format.');
  }

  const { id, version } = project.config;
  const started = uploadResponseSchema.parse(
    await api.post(`/v1/creator/games/${id}/versions`, { manifest, keyId: key.keyId, signature }),
  );
  const needed = new Set(started.missing);
  let uploaded = 0;
  for (const file of project.files) {
    if (!needed.has(file.sha256)) continue;
    needed.delete(file.sha256);
    await api.put(`/v1/creator/games/${id}/versions/${version}/files/${file.sha256}`, await readFile(file.absolutePath));
    uploaded++;
  }
  await api.post(`/v1/creator/games/${id}/versions/${version}/complete`);
  const game = gameResponseSchema.parse(await api.post(`/v1/creator/games/${id}/channels/${options.channel}`, { version }));
  const url = options.channel === 'production' ? game.url : game.previewUrl;
  runtime.output.info(
    `Published ${id} ${version} to ${options.channel}: uploaded ${uploaded} of ${project.files.length} files. Live at ${url}`,
  );
}

export async function listVersions(runtime: Runtime, directory: string) {
  const { config } = await loadProject(directory);
  const api = await client(runtime);
  const { versions } = versionListResponseSchema.parse(await api.get(`/v1/creator/games/${config.id}/versions`));
  if (versions.length === 0) runtime.output.info('No versions yet.');
  for (const entry of versions) {
    const live = entry.channels.length > 0 ? ` (${entry.channels.join(', ')})` : '';
    runtime.output.info(`${entry.version}  ${entry.status}  ${entry.fileCount} files  ${entry.totalBytes} bytes${live}`);
  }
}

export async function promote(runtime: Runtime, directory: string, version: string, channel: Channel) {
  const { config } = await loadProject(directory);
  const api = await client(runtime);
  const game = gameResponseSchema.parse(await api.post(`/v1/creator/games/${config.id}/channels/${channel}`, { version }));
  runtime.output.info(`${config.id} ${version} is live on ${channel} at ${channel === 'production' ? game.url : game.previewUrl}`);
}
