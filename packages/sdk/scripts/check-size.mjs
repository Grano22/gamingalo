// Fails the build when the core bundle exceeds its size budget (sdk-initiation AC-8).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 15 * 1024;
const size = gzipSync(readFileSync(new URL('../dist/index.js', import.meta.url))).length;
const summary = `core bundle: ${size} bytes gzipped, budget ${BUDGET_BYTES}`;

if (size > BUDGET_BYTES) {
  console.error(`Over budget. ${summary}`);
  process.exit(1);
}
console.log(summary);
