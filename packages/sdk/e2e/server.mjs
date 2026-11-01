// Serves the built package as plain files, so tests see what a game maker's page would load.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };

createServer(async (request, response) => {
  const file = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
  try {
    if (!file.startsWith(root)) throw new Error('Outside root');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(Number(process.argv[2]), '127.0.0.1');
