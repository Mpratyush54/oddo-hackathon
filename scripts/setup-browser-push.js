// Owner setup: generate persistent VAPID keys once, inside the ignored .env.
import { loadEnvFile } from 'node:process';
import { appendFile } from 'node:fs/promises';
import webpush from 'web-push';
loadEnvFile('.env');
if (!!process.env.VAPID_PUBLIC_KEY !== !!process.env.VAPID_PRIVATE_KEY)
  throw new Error('Supply both VAPID keys or remove both to generate a pair.');
const additions = [];
if (!process.env.VAPID_PUBLIC_KEY) {
  const keys = webpush.generateVAPIDKeys();
  additions.push(`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`);
}
if (!process.env.VAPID_SUBJECT)
  additions.push(`VAPID_SUBJECT=mailto:${process.env.EMAIL_FROM || 'mpratyush54@gmail.com'}`);
if (additions.length)
  await appendFile(
    '.env',
    '\n# Browser push: keep these keys stable across deployments.\n' + additions.join('\n') + '\n',
  );
console.log(
  'Browser push keys are ready in the ignored .env. Sync provider secrets before deployment.',
);
