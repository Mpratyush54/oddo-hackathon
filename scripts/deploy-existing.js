import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { zipSync } from 'fflate';

const exec = promisify(execFile);
const region = process.env.AWS_REGION || 'ap-south-1';
const stack = process.env.AWS_STACK_NAME || 'skyline-campus-api';
const artifactBucket = process.env.AWS_ARTIFACT_BUCKET;
if (!artifactBucket)
  throw new Error('Set AWS_ARTIFACT_BUCKET to the existing private artifact bucket.');
async function aws(args, json = true) {
  const result = await exec(
    'aws',
    [...args, '--region', region, '--no-cli-pager', ...(json ? ['--output', 'json'] : [])],
    {
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        AWS_CLI_FILE_ENCODING: 'UTF-8',
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
  );
  return json ? (result.stdout.trim() ? JSON.parse(result.stdout) : {}) : result.stdout;
}
const deployed = (await aws(['cloudformation', 'describe-stacks', '--stack-name', stack]))
  .Stacks[0];
if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(deployed.StackStatus))
  throw new Error(
    'Wait for the infrastructure deployment to finish before updating application code.',
  );
const outputs = Object.fromEntries(deployed.Outputs.map((o) => [o.OutputKey, o.OutputValue]));
if (outputs.DistributionId || outputs.BackendFunction !== `${stack}-backend`)
  throw new Error('This updater requires the existing API Gateway hosting stack.');
await mkdir('.aws-build', { recursive: true });
await exec(process.execPath, ['scripts/build-backend.js'], { maxBuffer: 10 * 1024 * 1024 });
await exec(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { maxBuffer: 1024 * 1024 });
await exec(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  maxBuffer: 10 * 1024 * 1024,
  env: { ...process.env, VITE_BACKEND_MODE: 'aws', VITE_API_URL: '/api' },
});
await cp('dist', '.aws-build/package/static', { recursive: true });
const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name + '/');
    else files[name] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect('.aws-build/package');
const zip = zipSync(files),
  file = path.resolve('.aws-build/backend-ci.zip');
await writeFile(file, zip);
const key = `backend/ci-${createHash('sha256').update(zip).digest('hex')}.zip`;
await aws(['s3api', 'put-object', '--bucket', artifactBucket, '--key', key, '--body', file]);
const configuration = await aws([
  'lambda',
  'get-function-configuration',
  '--function-name',
  outputs.BackendFunction,
]);
await aws([
  'lambda',
  'update-function-code',
  '--function-name',
  outputs.BackendFunction,
  '--s3-bucket',
  artifactBucket,
  '--s3-key',
  key,
  '--revision-id',
  configuration.RevisionId,
]);
await aws(
  ['lambda', 'wait', 'function-updated-v2', '--function-name', outputs.BackendFunction],
  false,
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
const health = await fetch(`${outputs.WebsiteUrl}/api/health`, {
  signal: AbortSignal.timeout(15000),
});
const result = await health.json();
if (!health.ok || result.auth !== 'JWT' || result.database !== 'DynamoDB')
  throw new Error('Post-deployment backend health check failed.');
const website = await fetch(outputs.WebsiteUrl, { signal: AbortSignal.timeout(15000) });
if (!website.ok || !(await website.text()).includes('<div id="root">'))
  throw new Error('Post-deployment website check failed.');
console.log(`Deployed Express backend and frontend: ${outputs.WebsiteUrl}`);
