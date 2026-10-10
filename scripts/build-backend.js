import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';
import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.aws-build', { recursive: true });
await build({
  entryPoints: ['frontend/src/demo/data/clubs.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: '.aws-build/seed-source.js',
});
const { organizations, makeClub } = await import(
  pathToFileURL(path.resolve('.aws-build/seed-source.js')).href
);
const clubs = Object.fromEntries(
  organizations.map((club) => {
    const data = makeClub(club.id);
    // Publish event/product fixtures only. Never seed demo identities, consent or finances in AWS.
    for (const field of [
      'members',
      'tickets',
      'orders',
      'transactions',
      'tasks',
      'announcements',
      'audit',
      'waitlist',
      'notifications',
      'deliveries',
      'pointLedger',
      'eventReviews',
    ])
      data[field] = [];
    data.events = data.events.map((event) => ({ ...event, sold: 0 }));
    data.profile = { name: '', email: '', role: '' };
    return [club.id, data];
  }),
);
for (const [clubId, data] of Object.entries(clubs))
  parseDatabaseRecord({
    pk: `COLLEGE#skyline-campus#CLUB#${clubId}`,
    sk: 'STATE',
    version: 1,
    data,
  });
const seed = JSON.stringify({ organizations, clubs }, null, 2);
await writeFile('backend/data/seed.json', seed);
const buildRoot = path.resolve('.aws-build');
const packageDirectory = path.resolve(buildRoot, 'package');
if (path.dirname(packageDirectory) !== buildRoot || path.basename(packageDirectory) !== 'package')
  throw new Error('Unexpected backend package directory.');
await rm(packageDirectory, { recursive: true, force: true });
await mkdir(packageDirectory, { recursive: true });
await build({
  entryPoints: ['backend/src/entrypoints/lambda.js'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: '.aws-build/package/lambda.js',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
await writeFile('.aws-build/package/seed.json', seed);
await writeFile('.aws-build/package/package.json', JSON.stringify({ type: 'module' }));
console.log('Built Express Lambda package and public-only club seed.');
