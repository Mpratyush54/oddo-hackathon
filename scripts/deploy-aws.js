import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, unlink, readdir, cp } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { zipSync } from 'fflate';
import { template, apiHostingTemplate } from '../infra/template.js';
import { loadLocalEnvironment } from '../backend/src/config/environment.js';

const exec = promisify(execFile);
// API hosting works with this account. CloudFront is an explicit opt-in after account verification.
const apiHosting = !process.argv.includes('--cloudfront');
const region = process.env.AWS_REGION || 'ap-south-1',
  stack = process.env.AWS_STACK_NAME || (apiHosting ? 'skyline-campus-api' : 'skyline-campus');
async function aws(args, json = true) {
  try {
    const result = await exec(
      'aws',
      [...args, '--region', region, '--no-cli-pager', ...(json ? ['--output', 'json'] : [])],
      {
        env: {
          ...process.env,
          AWS_CLI_FILE_ENCODING: 'UTF-8',
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return json ? (result.stdout.trim() ? JSON.parse(result.stdout) : {}) : result.stdout;
  } catch (error) {
    throw new Error(`AWS ${args[0]} ${args[1]} failed: ${error.stderr || error.message}`);
  }
}
loadLocalEnvironment();
await mkdir('.aws-build', { recursive: true });
const identity = await aws(['sts', 'get-caller-identity']);
const artifactBucket = `${stack}-artifacts-${identity.Account}-${region}`;
try {
  await aws(['s3api', 'head-bucket', '--bucket', artifactBucket]);
} catch {
  await aws([
    's3api',
    'create-bucket',
    '--bucket',
    artifactBucket,
    '--create-bucket-configuration',
    `LocationConstraint=${region}`,
  ]);
}
await aws([
  's3api',
  'put-public-access-block',
  '--bucket',
  artifactBucket,
  '--public-access-block-configuration',
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
]);
const secretName = `${stack}/backend`,
  secretPath = path.resolve('.aws-build/provider-secret.json');
let secretArn,
  prior = {};
try {
  const secret = await aws(['secretsmanager', 'get-secret-value', '--secret-id', secretName]);
  secretArn = secret.ARN;
  prior = JSON.parse(secret.SecretString);
} catch (error) {
  if (!error.message.includes('ResourceNotFoundException')) throw error;
}
const secrets = {
  ...prior,
  JWT_SECRET: prior.JWT_SECRET || randomBytes(64).toString('hex'),
  META_WEBHOOK_VERIFY_TOKEN: prior.META_WEBHOOK_VERIFY_TOKEN || randomBytes(32).toString('hex'),
};
for (const name of [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
  'EMAIL_VERIFICATION_ORIGIN',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'AI_DAILY_LIMIT',
  'META_WHATSAPP_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_GRAPH_VERSION',
  'META_TEST_RECIPIENTS',
  'META_WHATSAPP_TEMPLATE',
  'META_TEMPLATE_LANGUAGE',
  'META_TEMPLATE_PARAMETER_COUNT',
  'META_APP_SECRET',
  'META_WEBHOOK_VERIFY_TOKEN',
])
  if (process.env[name]?.trim()) secrets[name] = process.env[name].trim();
await writeFile(secretPath, JSON.stringify(secrets), { mode: 0o600 });
try {
  if (secretArn)
    await aws([
      'secretsmanager',
      'put-secret-value',
      '--secret-id',
      secretArn,
      '--secret-string',
      `file://${secretPath}`,
    ]);
  else
    secretArn = (
      await aws([
        'secretsmanager',
        'create-secret',
        '--name',
        secretName,
        '--secret-string',
        `file://${secretPath}`,
      ])
    ).ARN;
} finally {
  await unlink(secretPath);
}
console.log('Provider credentials and JWT signing key saved in AWS Secrets Manager.');
await exec(process.execPath, ['scripts/build-backend.js'], { maxBuffer: 10 * 1024 * 1024 });
if (apiHosting) {
  await exec(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-b', 'frontend/tsconfig.json'],
    {
      maxBuffer: 1024 * 1024,
    },
  );
  await exec(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--config', 'frontend/vite.config.ts'],
    {
      env: { ...process.env, VITE_BACKEND_MODE: 'aws', VITE_API_URL: '/api' },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  await cp('dist', '.aws-build/package/static', { recursive: true });
}
const zip = path.resolve('.aws-build/backend.zip');
const packageFiles = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name + '/');
    else packageFiles[name] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect('.aws-build/package');
await writeFile(zip, zipSync(packageFiles));
const artifactKey = `backend/${createHash('sha256')
  .update(await readFile(zip))
  .digest('hex')}.zip`;
await aws(['s3api', 'put-object', '--bucket', artifactBucket, '--key', artifactKey, '--body', zip]);
const templateFile = path.resolve('.aws-build/template.json');
await writeFile(
  templateFile,
  JSON.stringify(apiHosting ? apiHostingTemplate() : template, null, 2),
);
await aws(['cloudformation', 'validate-template', '--template-body', `file://${templateFile}`]);
let outputs = {};
try {
  const current = await aws(['cloudformation', 'describe-stacks', '--stack-name', stack]);
  outputs = Object.fromEntries(
    (current.Stacks[0].Outputs || []).map((o) => [o.OutputKey, o.OutputValue]),
  );
} catch (error) {
  if (!error.message.includes('does not exist')) throw error;
}
async function deploy(origin) {
  console.log(`Deploying ${stack} in ${region}.`);
  console.log(
    await aws(
      [
        'cloudformation',
        'deploy',
        '--stack-name',
        stack,
        '--template-file',
        templateFile,
        '--capabilities',
        'CAPABILITY_IAM',
        '--no-fail-on-empty-changeset',
        '--parameter-overrides',
        `ArtifactBucket=${artifactBucket}`,
        `ArtifactKey=${artifactKey}`,
        `ProviderSecretArn=${secretArn}`,
        `AppOrigin=${origin}`,
        '--tags',
        'Application=Skyline',
      ],
      false,
    ),
  );
  const result = await aws(['cloudformation', 'describe-stacks', '--stack-name', stack]);
  outputs = Object.fromEntries(result.Stacks[0].Outputs.map((o) => [o.OutputKey, o.OutputValue]));
}
const firstOrigin = outputs.WebsiteUrl || 'https://deployment-pending.invalid';
await deploy(firstOrigin);
if (firstOrigin !== outputs.WebsiteUrl && !process.argv.includes('--skip-origin-update'))
  await deploy(outputs.WebsiteUrl);
const seed = JSON.parse(await readFile('backend/data/seed.json', 'utf8'));
for (const [id, data] of Object.entries(seed.clubs)) {
  const itemPath = path.resolve(`.aws-build/seed-${id}.json`);
  await writeFile(
    itemPath,
    JSON.stringify({
      pk: { S: `COLLEGE#skyline-campus#CLUB#${id}` },
      sk: { S: 'STATE' },
      version: { N: '1' },
      data: { S: JSON.stringify(data) },
    }),
  );
  // Use DocumentClient marshalling without loading AWS credentials into this process.
  const { marshall } = await import('@aws-sdk/util-dynamodb');
  await writeFile(
    itemPath,
    JSON.stringify(
      marshall(
        parseDatabaseRecord({
          pk: `COLLEGE#skyline-campus#CLUB#${id}`,
          sk: 'STATE',
          version: 1,
          data,
        }),
        { removeUndefinedValues: true },
      ),
    ),
  );
  try {
    await aws([
      'dynamodb',
      'put-item',
      '--table-name',
      outputs.DataTable,
      '--item',
      `file://${itemPath}`,
      '--condition-expression',
      'attribute_not_exists(pk)',
    ]);
  } catch (error) {
    if (!error.message.includes('ConditionalCheckFailedException')) throw error;
  }
}
await writeFile(
  'AWS_DEPLOYMENT_OUTPUT.json',
  JSON.stringify({ stack, region, ...outputs }, null, 2),
);
if (!process.argv.includes('--infra-only')) {
  console.log('Building the frontend with the custom JWT backend enabled.');
  const result = await exec(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-b', 'frontend/tsconfig.json'],
    {
      maxBuffer: 1024 * 1024,
    },
  );
  await exec(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--config', 'frontend/vite.config.ts'],
    {
      env: { ...process.env, VITE_BACKEND_MODE: 'aws', VITE_API_URL: '/api' },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  await aws(
    [
      's3',
      'sync',
      'dist/',
      `s3://${outputs.FrontendBucket}/`,
      '--exclude',
      'index.html',
      '--cache-control',
      'public,max-age=31536000,immutable',
    ],
    false,
  );
  await aws(
    [
      's3',
      'cp',
      'dist/index.html',
      `s3://${outputs.FrontendBucket}/index.html`,
      '--cache-control',
      'no-cache,no-store,must-revalidate',
      '--content-type',
      'text/html',
    ],
    false,
  );
  if (outputs.DistributionId)
    await aws([
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      outputs.DistributionId,
      '--paths',
      '/*',
    ]);
}
console.log(
  JSON.stringify(
    {
      website: outputs.WebsiteUrl,
      apiHealth: `${outputs.WebsiteUrl}/api/health`,
      webhook: `${outputs.WebsiteUrl}/api/webhooks/whatsapp`,
      table: outputs.DataTable,
    },
    null,
    2,
  ),
);
