import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { accountKey } from '../server/auth.js';
import { applyAction } from '../server/domain.js';
import { clubKey, dateToday, timestamp, recordId } from '../server/repository.js';

const [email, clubId = 'skyline'] = process.argv.slice(2);
if (!email || !['skyline', 'codecraft', 'canvas'].includes(clubId))
  throw new Error('Usage: node scripts/activate-membership.js email clubId');
const deployment = JSON.parse(readFileSync('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
const cliEnv = {
  ...process.env,
  AWS_CLI_FILE_ENCODING: 'UTF-8',
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
};
function aws(args) {
  return JSON.parse(
    execFileSync(
      'aws',
      [...args, '--region', deployment.region, '--output', 'json', '--no-cli-pager'],
      { encoding: 'utf8', env: cliEnv },
    ) || '{}',
  );
}
function get(pk, sk) {
  const row = aws([
    'dynamodb',
    'get-item',
    '--table-name',
    deployment.DataTable,
    '--key',
    JSON.stringify(marshall({ pk, sk })),
    '--consistent-read',
  ]).Item;
  return row ? unmarshall(row) : null;
}
const account = get(accountKey(email), 'ACCOUNT');
if (!account) throw new Error('Register the account first.');
const user = get('USER#' + account.id, 'PROFILE');
const current = get(clubKey(clubId), 'STATE');
let data = current.data;
let member = data.members.find((m) => m.userId === user.id);
if (!member) {
  data = applyAction(data, { type: 'membership.join', args: {} }, user, 'admin').data;
  member = data.members.find((m) => m.userId === user.id);
}
if (member.status === 'Active' && member.expires >= dateToday()) {
  console.log('Membership is already active.');
  process.exit(0);
}
member.status = 'Active';
member.expires = `${Number(dateToday().slice(0, 4)) + 1}-07-31`;
member.duesWaived = true;
member.enrollmentSource = 'administrator';
const audit = {
  id: recordId('AUD'),
  actor: 'AWS administrator',
  clubId,
  collegeId: 'skyline-campus',
  action: 'membership.admin-enroll',
  entity: 'membership',
  entityId: member.id,
  date: timestamp(),
  detail: 'Administrator granted complimentary enrollment; no payment collected.',
};
data.audit = [audit, ...(data.audit || [])].slice(0, 100);
const transaction = [
  {
    Put: {
      TableName: deployment.DataTable,
      Item: marshall(
        { ...current, version: current.version + 1, data },
        { removeUndefinedValues: true },
      ),
      ConditionExpression: '#version = :previous',
      ExpressionAttributeNames: { '#version': 'version' },
      ExpressionAttributeValues: { ':previous': { N: String(current.version) } },
    },
  },
  {
    Put: {
      TableName: deployment.DataTable,
      Item: marshall({ pk: current.pk, sk: `AUDIT#${audit.date}#${audit.id}`, ...audit }),
      ConditionExpression: 'attribute_not_exists(pk)',
    },
  },
];
mkdirSync('.aws-build', { recursive: true });
const file = path.resolve('.aws-build/membership-transaction.json');
writeFileSync(file, JSON.stringify(transaction));
try {
  aws(['dynamodb', 'transact-write-items', '--transact-items', `file://${file}`]);
} finally {
  unlinkSync(file);
}
console.log(
  `Membership active in ${clubId}; expires ${member.expires}. No payment collected. Reload your workspace.`,
);
