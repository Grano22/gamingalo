// Checks that requirements, phases, specs and decisions agree with each other.
// Every requirement belongs to one spec in its own phase, unless it's TBD or Parked.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const list = (dir, pattern) => readdirSync(join(root, dir)).filter((name) => pattern.test(name)).map((name) => join(dir, name));

const ID = /\b(?:SDK|BE|WEB|WRAP|CLI|MCP|XC|SRV|PLG)-\d{3}\b/g;
const errors = [];
const requirements = new Map();

for (const file of list('features', /\.md$/)) {
  for (const line of read(file).split('\n')) {
    const match = /^\|\s*((?:SDK|BE|WEB|WRAP|CLI|MCP|XC|SRV|PLG)-\d{3})\s*\|.*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*$/.exec(line);
    if (!match) continue;
    const [, id, , phase] = match;
    if (requirements.has(id)) errors.push(`${id} is defined twice`);
    requirements.set(id, phase);
  }
}

const planned = new Map();
let specs = 0;
for (const file of list('phases', /^phase-\d.*\.md$/)) {
  const phase = `P${/phase-(\d)/.exec(file)[1]}`;
  for (const line of read(file).split('\n')) {
    const match = /^\|\s*`([^`]+)`\s*\|([^|]*)\|/.exec(line);
    if (!match) continue;
    specs++;
    for (const id of match[2].match(ID) ?? []) {
      if (planned.has(id)) errors.push(`${id} is in two specs`);
      planned.set(id, phase);
    }
  }
}

for (const [id, phase] of requirements) {
  if (phase === 'TBD' || phase === 'Parked') {
    if (planned.has(id)) errors.push(`${id} is ${phase}, but has a spec`);
  } else if (!planned.has(id)) {
    errors.push(`${id} (${phase}) has no spec`);
  } else if (planned.get(id) !== phase) {
    errors.push(`${id} is ${phase} in features, but ${planned.get(id)} in phases`);
  }
}
for (const id of planned.keys()) if (!requirements.has(id)) errors.push(`${id} is planned, but not defined`);

const decisions = new Set(read('docs/decisions.md').match(/^\| (D-\d\d) /gm)?.map((row) => row.slice(2, 6)));
const documents = [
  ...list('features', /\.md$/),
  ...list('phases', /\.md$/),
  'docs/decisions.md',
  'AGENTS.md',
  'TODO.md',
  ...readdirSync(join(root, '.specs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .map((entry) => join('.specs', entry.name, 'spec.md')),
];
for (const file of documents) {
  const text = read(file);
  for (const id of new Set(text.match(ID))) if (!requirements.has(id)) errors.push(`${file} mentions unknown ${id}`);
  for (const decision of new Set(text.match(/\bD-\d\d\b/g))) {
    if (!decisions.has(decision)) errors.push(`${file} mentions unknown ${decision}`);
  }
}

console.log(`${requirements.size} requirements, ${planned.size} planned, ${specs} specs, ${decisions.size} decisions`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('The plan is consistent.');
