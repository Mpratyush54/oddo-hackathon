import { marshall } from '@aws-sdk/util-dynamodb';
import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { accountKey } from '../backend/src/modules/auth/index.js';

const [email, clubId, role] = process.argv.slice(2);
if (
  !email ||
  !['skyline', 'codecraft', 'canvas'].includes(clubId) ||
  !['member', 'organizer', 'treasurer', 'admin', 'college'].includes(role)
)
  throw new Error(
    'Usage: node scripts/grant-role.js email clubId member|organizer|treasurer|admin|college',
  );
const deployment = JSON.parse(readFileSync('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
function aws(args) {
  return JSON.parse(
    execFileSync(
      'aws',
      [...args, '--region', deployment.region, '--output', 'json', '--no-cli-pager'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          AWS_CLI_FILE_ENCODING: 'UTF-8',
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
      },
    ) || '{}',
  );
}
const account = aws([
  'dynamodb',
  'get-item',
  '--table-name',
  deployment.DataTable,
  '--key',
  JSON.stringify({ pk: { S: accountKey(email) }, sk: { S: 'ACCOUNT' } }),
]).Item;
if (!account) throw new Error('Sign up in the deployed app before granting a role.');
mkdirSync('.aws-build', { recursive: true });
const file = path.resolve('.aws-build/role.json');
writeFileSync(
  file,
  JSON.stringify(
    marshall(
      parseDatabaseRecord({
        pk: `USER#${account.id.S}`,
        sk: `ACCESS#${clubId}`,
        clubId,
        role,
        collegeId: 'skyline-campus',
      }),
    ),
  ),
);
try {
  aws(['dynamodb', 'put-item', '--table-name', deployment.DataTable, '--item', `file://${file}`]);
} finally {
  unlinkSync(file);
}
console.log(`Granted ${role} for ${clubId}. Reload the user's workspace.`);
