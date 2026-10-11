import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoRepository } from '../../backend/src/database/repositories/dynamo.repository.js';
const exec = promisify(execFile);
export async function ownerAws(args, region = 'ap-south-1') {
  const { stdout } = await exec(
    'aws',
    [...args, '--region', region, '--output', 'json', '--no-cli-pager'],
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
  return stdout.trim() ? JSON.parse(stdout) : {};
}
export function ownerCredentials(region) {
  return async () => {
    const result = await ownerAws(
      ['configure', 'export-credentials', '--format', 'process'],
      region,
    );
    return {
      accessKeyId: result.AccessKeyId,
      secretAccessKey: result.SecretAccessKey,
      sessionToken: result.SessionToken,
      expiration: new Date(result.Expiration),
    };
  };
}
export function ownerRepository(table, region) {
  return new DynamoRepository(
    table,
    DynamoDBDocumentClient.from(
      new DynamoDBClient({ region, credentials: ownerCredentials(region) }),
      { marshallOptions: { removeUndefinedValues: true } },
    ),
  );
}
