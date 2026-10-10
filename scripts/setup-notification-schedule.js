// Owner-only infrastructure update. Run after deploying the worker code.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { template } from '../infra/template.js';
const exec = promisify(execFile),
  stack = process.env.AWS_STACK_NAME || 'skyline-campus-api';
async function aws(args) {
  const { stdout } = await exec(
    'aws',
    [
      ...args,
      '--region',
      process.env.AWS_REGION || 'ap-south-1',
      '--output',
      'json',
      '--no-cli-pager',
    ],
    { maxBuffer: 10485760 },
  );
  return stdout.trim() ? JSON.parse(stdout) : {};
}
const current = await aws(['cloudformation', 'get-template', '--stack-name', stack]);
const body =
  typeof current.TemplateBody === 'string'
    ? JSON.parse(current.TemplateBody)
    : current.TemplateBody;
if (!body.Resources?.Backend)
  throw new Error('The existing stack does not contain the expected backend.');
const desired = {
  NotificationSchedule: template.Resources.NotificationSchedule,
  NotificationInvoke: template.Resources.NotificationInvoke,
};
if (
  Object.entries(desired).every(
    ([name, value]) => JSON.stringify(body.Resources[name]) === JSON.stringify(value),
  )
) {
  console.log('The notification schedule is already configured.');
} else {
  Object.assign(body.Resources, desired);
  await mkdir('.aws-build', { recursive: true });
  const file = path.resolve('.aws-build/notification-schedule.json');
  await writeFile(file, JSON.stringify(body));
  try {
    await aws([
      'cloudformation',
      'update-stack',
      '--stack-name',
      stack,
      '--template-body',
      'file://' + file,
      '--capabilities',
      'CAPABILITY_NAMED_IAM',
      '--parameters',
      ...Object.keys(body.Parameters || {}).map((ParameterKey) =>
        JSON.stringify({ ParameterKey, UsePreviousValue: true }),
      ),
    ]);
    console.log(
      'Notification schedule update started. Wait for stack-update-complete before verification.',
    );
  } finally {
    await unlink(file);
  }
}
