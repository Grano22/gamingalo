// Checks what a production game downloads: the core budget, each module's budget, and that
// neither mock code nor optional modules reach the core.
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const CORE_BUDGET_BYTES = 15 * 1024;
const MODULE_BUDGET_BYTES = 6 * 1024;
// Text that appears only in each source file, to prove where code ended up.
const MARKERS = {
  mock: 'Mock mode is only available in a test context',
  accessibility: 'data-gamingalo-accessibility',
  localization: 'getLayoutMap',
};

const dist = new URL('../dist/', import.meta.url);
const read = (file) => readFileSync(new URL(file, dist), 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Files loaded by static imports, which every game downloads. */
function staticClosure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const match of read(file).matchAll(/(?:from\s*|import\s+)["']\.\/([^"']+)["']/g)) staticClosure(match[1], seen);
  return seen;
}

function dynamicImports(files) {
  const found = new Set();
  for (const file of files) {
    for (const match of read(file).matchAll(/import\(\s*["']\.\/([^"']+)["']\s*\)/g)) found.add(match[1]);
  }
  return found;
}

const gzipSize = (files) => gzipSync(Buffer.concat([...files].map((file) => Buffer.from(read(file))))).length;

if (!existsSync(new URL('testing.js', dist))) fail('dist/testing.js is missing.');
if (!read('testing.js').includes(MARKERS.mock)) fail('The mock marker text is missing, so this check no longer works.');

const core = staticClosure('index.js');
const coreText = [...core].map(read).join('\n');
for (const [name, marker] of Object.entries(MARKERS)) {
  if (core.has('testing.js') || coreText.includes(marker)) fail(`${name} code reached the core bundle: ${[...core].join(', ')}`);
}

const coreSize = gzipSize(core);
console.log(`core: ${coreSize} bytes gzipped, budget ${CORE_BUDGET_BYTES} (${[...core].join(', ')})`);
if (coreSize > CORE_BUDGET_BYTES) fail('The core is over budget.');

const modules = dynamicImports(core);
if (modules.size < 2) fail(`Expected the accessibility and localization modules as separate files, found: ${[...modules].join(', ')}`);
for (const module of modules) {
  const own = [...staticClosure(module)].filter((file) => !core.has(file));
  const size = gzipSize(own);
  console.log(`module ${module}: ${size} bytes gzipped, budget ${MODULE_BUDGET_BYTES}`);
  if (size > MODULE_BUDGET_BYTES) fail(`The module ${module} is over budget.`);
}
