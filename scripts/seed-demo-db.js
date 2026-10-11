/**
 * Build full makeClub demo state and write it into DynamoDB (force overwrite).
 * Public AWS seed.json stays stripped; this script is for demo/dev data only.
 *
 * Usage: node scripts/seed-demo-db.js
 *        node scripts/seed-demo-db.js --dry-run
 */
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';
import { clubKey } from '../backend/src/shared/records.js';

const dryRun = process.argv.includes('--dry-run');

await mkdir('.aws-build', { recursive: true });
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

const clubs = Object.fromEntries(
  organizations.map((org) => {
    const data = enrichEventHistory(makeClub(org.id), org.id);
    parseDatabaseRecord({
      pk: clubKey(org.id),
      sk: 'STATE',
      version: 1,
      data,
    });
    return [org.id, data];
  }),
);

const summary = Object.fromEntries(
  Object.entries(clubs).map(([id, c]) => [
    id,
    {
      members: c.members.length,
      events: c.events.map((e) => `${e.id}:${e.sold}/${e.capacity}`),
      tickets: c.tickets.length,
      orders: c.orders.length,
      waitlist: c.waitlist.length,
      audit: c.audit.length,
      pointLedger: c.pointLedger?.length || 0,
      announcements: c.announcements.length,
    },
  ]),
);
console.log(JSON.stringify({ dryRun, summary }, null, 2));

await writeFile('.aws-build/seed-full.json', JSON.stringify({ organizations, clubs }, null, 2));

if (dryRun) {
  console.log('Dry run only — DynamoDB unchanged.');
  process.exit(0);
}

const deployment = JSON.parse(await readFile('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
const table = deployment.DataTable;
const region = deployment.region;
if (!table || !region) throw new Error('AWS_DEPLOYMENT_OUTPUT.json is missing DataTable/region.');

function mergePaidPurchases(seedData, existingData) {
  if (!existingData) return seedData;
  const next = structuredClone(seedData);
  const keepTicket = (t) => Boolean(t.paymentId || t.userId);
  const keepOrder = (o) => Boolean(o.paymentId || o.userId);
  const keepMember = (m) => Boolean(m.userId || m.membershipPaymentId);
  for (const ticket of (existingData.tickets || []).filter(keepTicket)) {
    if (!next.tickets.some((t) => t.id === ticket.id || t.paymentId === ticket.paymentId))
      next.tickets.unshift(ticket);
  }
  for (const order of (existingData.orders || []).filter(keepOrder)) {
    if (!next.orders.some((o) => o.id === order.id || o.paymentId === order.paymentId))
      next.orders.unshift(order);
  }
  for (const member of (existingData.members || []).filter(keepMember)) {
    const idx = next.members.findIndex(
      (m) => m.userId === member.userId || m.email === member.email || m.id === member.id,
    );
    if (idx >= 0) next.members[idx] = { ...next.members[idx], ...member, id: next.members[idx].id };
    else next.members.unshift(member);
  }
  // Recompute sold from confirmed tickets so capacity math stays honest.
  for (const event of next.events) {
    event.sold = next.tickets.filter(
      (t) => t.eventId === event.id && t.status !== 'Cancelled',
    ).length;
  }
  return next;
}

for (const [id, seedData] of Object.entries(clubs)) {
  const keyPath = path.resolve(`.aws-build/seed-key-${id}.json`);
  await writeFile(
    keyPath,
    JSON.stringify(marshall({ pk: clubKey(id), sk: 'STATE' })),
  );
  let existing = null;
  try {
    const got = JSON.parse(
      execFileSync(
        'aws',
        [
          'dynamodb',
          'get-item',
          '--table-name',
          table,
          '--region',
          region,
          '--key',
          `file://${keyPath}`,
          '--output',
          'json',
          '--no-cli-pager',
        ],
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
        },
      ),
    );
    if (got.Item) existing = unmarshall(got.Item);
  } catch {
    existing = null;
  }
  const data = mergePaidPurchases(seedData, existing?.data);
  const itemPath = path.resolve(`.aws-build/seed-full-${id}.json`);
  const record = parseDatabaseRecord({
    pk: clubKey(id),
    sk: 'STATE',
    version: Number(existing?.version || 0) + 1,
    data,
  });
  await writeFile(itemPath, JSON.stringify(marshall(record, { removeUndefinedValues: true })));
  execFileSync(
    'aws',
    [
      'dynamodb',
      'put-item',
      '--table-name',
      table,
      '--region',
      region,
      '--item',
      `file://${itemPath}`,
      '--output',
      'json',
      '--no-cli-pager',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        AWS_CLI_FILE_ENCODING: 'UTF-8',
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
  );
  console.log(
    `Seeded ${id} → ${table} (preserved ${
      (existing?.data?.tickets || []).filter((t) => t.paymentId).length
    } paid tickets)`,
  );
}

console.log('Full demo club state written to DynamoDB (paid purchases preserved).');
