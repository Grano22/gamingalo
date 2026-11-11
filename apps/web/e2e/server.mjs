// Serves the production build as a deployment would: static files, the app shell for page
// routes, and /api forwarded to the web services. Used by the browser tests.
import { readFile } from 'node:fs/promises';
import { createServer, request as forward } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [port, apiPort] = process.argv.slice(2).map(Number);
const root = fileURLToPath(new URL('../dist/browser/', import.meta.url));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url ?? '/', 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    const proxied = forward(
      {
        host: '127.0.0.1',
        port: apiPort,
        method: incoming.method,
        path: url.pathname.slice('/api'.length) + url.search,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    proxied.on('error', () => outgoing.writeHead(502).end());
    incoming.pipe(proxied);
    return;
  }

  const file = resolve(root, `.${url.pathname}`);
  const isAsset = extname(url.pathname) !== '';
  try {
    // `resolve` drops the trailing separator, so the root itself is compared without it.
    if (file !== root.slice(0, -1) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      throw new Error('Outside root');
    }
    const body = await readFile(isAsset ? file : resolve(root, 'index.html'));
    outgoing.writeHead(200, { 'content-type': types[isAsset ? extname(file) : '.html'] ?? 'application/octet-stream' });
    outgoing.end(body);
  } catch {
    outgoing.writeHead(404).end();
  }
}).listen(port, 'localhost');
