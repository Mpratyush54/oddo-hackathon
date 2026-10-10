import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadEnvFile } from 'node:process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Owner-only setup. GitHub's deploy role deliberately cannot read provider secrets.
loadEnvFile('.env');
const exec = promisify(execFile);
const region = process.env.AWS_REGION || 'ap-south-1';
const secretName = (process.env.AWS_STACK_NAME || 'skyline-campus-api') + '/backend';
const fields = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
  'EMAIL_VERIFICATION_ORIGIN',
  'META_WHATSAPP_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_GRAPH_VERSION',
  'META_TEST_RECIPIENTS',
  'META_WHATSAPP_TEMPLATE',
  'META_TEMPLATE_LANGUAGE',
  'META_TEMPLATE_PARAMETER_COUNT',
  'META_APP_SECRET',
];
async function aws(args) {
  const { stdout } = await exec(
    'aws',
    [...args, '--region', region, '--no-cli-pager', '--output', 'json'],
    {
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        AWS_CLI_FILE_ENCODING: 'UTF-8',
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
  );
  return stdout.trim() ? JSON.parse(stdout) : {};
}
const prior = await aws(['secretsmanager', 'get-secret-value', '--secret-id', secretName]);
const secrets = JSON.parse(prior.SecretString);
const changed = [];
for (const field of fields)
  if (process.env[field]?.trim()) {
    secrets[field] = process.env[field].trim();
    changed.push(field);
  }
await mkdir('.aws-build', { recursive: true });
const file = path.resolve('.aws-build/provider-sync-' + randomUUID() + '.json');
try {
  await writeFile(file, JSON.stringify(secrets), { mode: 0o600 });
  await aws([
    'secretsmanager',
    'put-secret-value',
    '--secret-id',
    prior.ARN,
    '--secret-string',
    'file://' + file,
  ]);
} finally {
  await unlink(file).catch(() => {});
}
console.log(JSON.stringify({ secret: secretName, synchronizedFields: changed }));
