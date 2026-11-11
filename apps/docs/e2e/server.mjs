// Serves the static export as GitHub Pages would: folders resolve to index.html, and 404.html otherwise.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const [port, basePath = ''] = process.argv.slice(2);
const root = resolve(new URL('../out/', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

async function find(path) {
  const file = resolve(root, `.${path}`);
  if (file !== root && !file.startsWith(root + sep)) return undefined;
  const info = await stat(file).catch(() => undefined);
  if (info?.isFile()) return file;
  if (info?.isDirectory()) return (await stat(join(file, 'index.html')).catch(() => undefined)) ? join(file, 'index.html') : undefined;
  return undefined;
}

createServer(async (request, response) => {
  let path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (basePath && !path.startsWith(basePath)) return response.writeHead(404).end();
  path = path.slice(basePath.length) || '/';
  const file = await find(path);
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/html' });
    return response.end(await readFile(join(root, '404.html')).catch(() => 'Not found'));
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(file));
}).listen(Number(port), '127.0.0.1');
