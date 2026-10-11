import { readFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { createApp } from '../app.js';
import { loadLocalEnvironment } from '../config/environment.js';
import { MemoryRepository } from '../database/repositories/index.js';
import { clubKey } from '../shared/records.js';

loadLocalEnvironment();
const repo = new MemoryRepository();
const catalog = JSON.parse(
  await readFile(new URL('../../data/seed.json', import.meta.url), 'utf8'),
);
// Local memory uses the same full makeClub demo as the frontend (not the public-only AWS seed).
await mkdir(path.resolve('.aws-build'), { recursive: true });
await build({
  entryPoints: ['frontend/src/demo/data/clubs.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: '.aws-build/seed-source.js',
});
const { organizations, makeClub, enrichEventHistory } = await import(
  pathToFileURL(path.resolve('.aws-build/seed-source.js')).href
);
for (const org of organizations) {
  const data = enrichEventHistory(makeClub(org.id), org.id);
  await repo.put({ pk: clubKey(org.id), sk: 'STATE', version: 1, data });
}
const env = {
  ...process.env,
  NODE_ENV: 'development',
  JWT_SECRET: process.env.JWT_SECRET || randomBytes(64).toString('hex'),
};
createApp({ env, repo, clubs: catalog.organizations || organizations }).listen(
  Number(env.API_PORT || 3001),
  '127.0.0.1',
  () =>
    console.log('Skyline JWT backend: http://127.0.0.1:3001 (local memory data resets on restart)'),
);
