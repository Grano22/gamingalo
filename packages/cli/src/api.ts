import { errorResponseSchema, metaResponseSchema, FORMAT_VERSIONS } from '@gamingalo/contracts';
import { CliError } from './errors';
import type { Credentials } from './settings';

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ apiUrl, token }: Credentials, fetchFn: typeof fetch = fetch) {
  const base = apiUrl.replace(/\/+$/, '');

  async function send(method: string, path: string, body?: unknown, raw?: Uint8Array): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchFn(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          'user-agent': `gamingalo-cli/${__CLI_VERSION__}`,
          ...(raw ? { 'content-type': 'application/octet-stream' } : body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(raw ? { body: raw } : body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (cause) {
      throw new CliError(`Could not reach ${base}: ${(cause as Error).message}`, 'NETWORK');
    }
    const text = await response.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(json);
      if (parsed.success) throw new CliError(parsed.data.error.message, parsed.data.error.code);
      throw new CliError(`The request failed with status ${response.status}.`, 'HTTP');
    }
    return json;
  }

  return {
    get: (path: string) => send('GET', path),
    post: (path: string, body: unknown = {}) => send('POST', path, body),
    put: (path: string, bytes: Uint8Array) => send('PUT', path, undefined, bytes),

    /** Refuses to continue if the service needs a manifest format this CLI doesn't write. */
    async checkCompatibility(): Promise<void> {
      const meta = metaResponseSchema.safeParse(await send('GET', '/v1/meta'));
      if (!meta.success) throw new CliError('The service sent an unexpected response. Is the API URL right?', 'INCOMPATIBLE');
      if (meta.data.formats.manifest !== FORMAT_VERSIONS.manifest) {
        throw new CliError(
          `The service uses manifest format ${meta.data.formats.manifest}, and this CLI writes ${FORMAT_VERSIONS.manifest}. Update the CLI.`,
          'INCOMPATIBLE',
        );
      }
    },
  };
}
