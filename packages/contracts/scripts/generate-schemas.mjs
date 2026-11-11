// Writes the JSON Schema for gamingalo.json, generated from the Zod schema so they can't drift (D-04).
import { mkdirSync, writeFileSync } from 'node:fs';
import { toJSONSchema } from 'zod';
import { gameConfigSchema } from '../dist/index.js';

const schema = {
  $id: 'https://gamingalo.example/schemas/gamingalo.schema.json',
  title: 'gamingalo.json',
  ...toJSONSchema(gameConfigSchema, { io: 'input' }),
};
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/gamingalo.schema.json', import.meta.url), `${JSON.stringify(schema, null, 2)}\n`);
console.log('wrote dist/gamingalo.schema.json');
