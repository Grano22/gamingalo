// Checks everything a production game loads: the size budget, and that it contains no mock code.
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 15 * 1024;
// Text that appears only in src/testing.ts.
const MOCK_MARKER = 'Mock mode is only available in a test context';

const dist = new URL('../dist/', import.meta.url);

/** Follows static and dynamic imports from a file and returns every file it loads. */
function collect(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(new URL(file, dist), 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)["']\.\/([^"']+)["']/g)) {
    collect(match[1], seen);
  }
  return seen;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(new URL('testing.js', dist))) fail('dist/testing.js is missing.');
if (!readFileSync(new URL('testing.js', dist), 'utf8').includes(MOCK_MARKER)) {
  fail('The mock marker text was not found in dist/testing.js, so this check no longer works.');
}

const files = [...collect('index.js')];
const contents = files.map((file) => readFileSync(new URL(file, dist)));

if (files.includes('testing.js') || contents.some((content) => content.includes(MOCK_MARKER))) {
  fail(`Mock code reached the production bundle: ${files.join(', ')}`);
}

const size = gzipSync(Buffer.concat(contents)).length;
const summary = `production bundle: ${size} bytes gzipped (${files.join(', ')}), budget ${BUDGET_BYTES}`;
if (size > BUDGET_BYTES) fail(`Over budget. ${summary}`);
console.log(summary);
