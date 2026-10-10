import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.aws-build', { recursive: true });
await build({
  entryPoints: ['src/store.tsx'],
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
const seed = JSON.stringify({ organizations, clubs }, null, 2);
await writeFile('server/seed.json', seed);
await mkdir('.aws-build/package', { recursive: true });
await build({
  entryPoints: ['server/lambda.js'],
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
