import serverlessExpress from '@codegenie/serverless-express';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { readFile } from 'node:fs/promises';
import { createApp } from '../app.js';
import { DynamoRepository } from '../database/repositories/index.js';
import { createDomain } from '../modules/clubs/club.service.js';
import { DeliveryWorker } from '../modules/notifications/delivery-worker.service.js';

let adapter;
let worker;
export async function handler(event, context) {
  if (!adapter) {
    const secret = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: process.env.PROVIDER_SECRET_ARN }),
    );
    const env = { ...process.env, ...JSON.parse(secret.SecretString) };
    const { organizations } = JSON.parse(
      await readFile(new URL('./seed.json', import.meta.url), 'utf8'),
    );
    const repo = new DynamoRepository(env.DATA_TABLE);
    worker = new DeliveryWorker({
      env,
      repo,
      clubs: organizations,
      domain: createDomain({ repo, clubs: organizations, paymentsRequired: true }),
    });
    adapter = serverlessExpress({ app: createApp({ env, repo, clubs: organizations }) });
  }
  if (event.source === 'skyline.notifications' && !event.requestContext)
    return worker.run({
      deadline:
        Date.now() + Math.min(18000, (context.getRemainingTimeInMillis?.() || 28000) - 5000),
    });
  return adapter(event, context);
}
