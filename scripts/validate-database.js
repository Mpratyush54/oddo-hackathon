import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';
import { clubKey } from '../backend/src/shared/records.js';

const live = process.argv.includes('--live');
let records;
if (live) {
  const deployment = JSON.parse(readFileSync('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
  const result = JSON.parse(
    execFileSync(
      'aws',
      [
        'dynamodb',
        'scan',
        '--table-name',
        deployment.DataTable,
        '--region',
        deployment.region,
        '--consistent-read',
        '--output',
        'json',
        '--no-cli-pager',
      ],
      {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        env: {
          ...process.env,
          AWS_CLI_FILE_ENCODING: 'UTF-8',
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
      },
    ),
  );
  records = result.Items.map(unmarshall);
} else {
  const seed = JSON.parse(readFileSync('backend/data/seed.json', 'utf8'));
  records = Object.entries(seed.clubs).map(([clubId, data]) => ({
    pk: clubKey(clubId),
    sk: 'STATE',
    version: 1,
    data,
  }));
}
let failed = 0;
const kinds = {};
for (const record of records) {
  const kind = record.sk.split('#')[0];
  kinds[kind] = (kinds[kind] || 0) + 1;
  try {
    parseDatabaseRecord(record);
  } catch (error) {
    failed++;
    console.error(JSON.stringify({ kind, issues: error.issues }));
  }
}
console.log(
  JSON.stringify({
    source: live ? 'AWS (read only)' : 'seed',
    checked: records.length,
    failed,
    kinds,
  }),
);
if (failed) process.exitCode = 1;
