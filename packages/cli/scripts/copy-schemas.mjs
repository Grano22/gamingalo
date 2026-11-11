// Ships the gamingalo.json JSON Schema with the CLI, so a game's "$schema" can point at node_modules.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = require.resolve('@gamingalo/contracts/gamingalo.schema.json');
mkdirSync(new URL('../schemas/', import.meta.url), { recursive: true });
copyFileSync(source, new URL('../schemas/gamingalo.schema.json', import.meta.url));
