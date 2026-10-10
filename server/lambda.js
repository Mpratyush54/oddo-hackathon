import serverlessExpress from '@codegenie/serverless-express';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';
import { DynamoRepository } from './repository.js';

let adapter;
export async function handler(event, context) {
  if (!adapter) {
    const secret = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: process.env.PROVIDER_SECRET_ARN }),
    );
    const env = { ...process.env, ...JSON.parse(secret.SecretString) };
    const { organizations } = JSON.parse(
      await readFile(new URL('./seed.json', import.meta.url), 'utf8'),
    );
    adapter = serverlessExpress({
      app: createApp({ env, repo: new DynamoRepository(env.DATA_TABLE), clubs: organizations }),
    });
  }
  return adapter(event, context);
}
