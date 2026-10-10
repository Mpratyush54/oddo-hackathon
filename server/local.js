import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.js';
import { loadLocalEnvironment } from './api.js';
import { MemoryRepository, clubKey } from './repository.js';

loadLocalEnvironment();
const repo = new MemoryRepository();
const seed = JSON.parse(await readFile(new URL('./seed.json', import.meta.url), 'utf8'));
for (const [id, data] of Object.entries(seed.clubs))
  await repo.put({ pk: clubKey(id), sk: 'STATE', version: 1, data });
const env = {
  ...process.env,
  NODE_ENV: 'development',
  JWT_SECRET: process.env.JWT_SECRET || randomBytes(64).toString('hex'),
};
createApp({ env, repo, clubs: seed.organizations }).listen(
  Number(env.API_PORT || 3001),
  '127.0.0.1',
  () =>
    console.log('Skyline JWT backend: http://127.0.0.1:3001 (local memory data resets on restart)'),
);
