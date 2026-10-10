import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { databaseJsonSchema } from '../backend/src/database/schemas/json-schema.js';

const file = 'backend/database/schema.json';
const contents = JSON.stringify(databaseJsonSchema(), null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8').replaceAll('\r\n', '\n') !== contents)
    throw new Error('Database JSON Schema is outdated. Run npm run db:schema.');
  console.log('Database JSON Schema matches the runtime schemas.');
} else {
  mkdirSync('backend/database', { recursive: true });
  writeFileSync(file, contents);
  console.log(`Generated ${file}.`);
}
