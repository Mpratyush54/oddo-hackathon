import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const repository = 'Mpratyush54/oddo-hackathon';
const branch = 'main',
  region = 'ap-south-1',
  stack = 'skyline-campus-api';
const roleName = 'skyline-campus-api-github-deploy';
const cliEnv = {
  ...process.env,
  AWS_CLI_FILE_ENCODING: 'UTF-8',
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
};
const github = JSON.parse(execFileSync('gh', ['api', `repos/${repository}`], { encoding: 'utf8' }));
const oidc = JSON.parse(
  execFileSync('gh', ['api', `repos/${repository}/actions/oidc/customization/sub`], {
    encoding: 'utf8',
  }),
);
if (!oidc.use_default)
  throw new Error('This setup requires the repository default OIDC subject format.');
const subjectPrefix = oidc.use_immutable_subject
  ? `repo:${github.owner.login}@${github.owner.id}/${github.name}@${github.id}`
  : `repo:${github.full_name}`;
function aws(args) {
  return JSON.parse(
    execFileSync('aws', [...args, '--region', region, '--output', 'json', '--no-cli-pager'], {
      encoding: 'utf8',
      env: cliEnv,
    }) || '{}',
  );
}
mkdirSync('.aws-build', { recursive: true });
const account = aws(['sts', 'get-caller-identity']).Account;
const outputs = Object.fromEntries(
  aws(['cloudformation', 'describe-stacks', '--stack-name', stack]).Stacks[0].Outputs.map((o) => [
    o.OutputKey,
    o.OutputValue,
  ]),
);
const artifactBucket = `${stack}-artifacts-${account}-${region}`;
let provider = aws(['iam', 'list-open-id-connect-providers']).OpenIDConnectProviderList.find((p) =>
  p.Arn.endsWith('/token.actions.githubusercontent.com'),
)?.Arn;
if (!provider)
  provider = aws([
    'iam',
    'create-open-id-connect-provider',
    '--url',
    'https://token.actions.githubusercontent.com',
    '--client-id-list',
    'sts.amazonaws.com',
  ]).OpenIDConnectProviderArn;
const trust = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Federated: provider },
      Action: 'sts:AssumeRoleWithWebIdentity',
      Condition: {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `${subjectPrefix}:ref:refs/heads/${branch}`,
        },
      },
    },
  ],
};
// Application code updates only: no IAM changes, account passwords, database writes, or secret reads.
const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: 'cloudformation:DescribeStacks',
      Resource: `arn:aws:cloudformation:${region}:${account}:stack/${stack}/*`,
    },
    {
      Effect: 'Allow',
      Action: [
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:UpdateFunctionCode',
      ],
      Resource: `arn:aws:lambda:${region}:${account}:function:${outputs.BackendFunction}`,
    },
    {
      Effect: 'Allow',
      Action: ['s3:PutObject', 's3:GetObject'],
      Resource: [
        `arn:aws:s3:::${artifactBucket}/backend/*`,
        `arn:aws:s3:::${outputs.FrontendBucket}/*`,
      ],
    },
    {
      Effect: 'Allow',
      Action: ['s3:ListBucket', 's3:GetBucketLocation'],
      Resource: [`arn:aws:s3:::${artifactBucket}`, `arn:aws:s3:::${outputs.FrontendBucket}`],
    },
  ],
};
const trustFile = path.resolve('.aws-build/github-trust.json'),
  policyFile = path.resolve('.aws-build/github-policy.json');
writeFileSync(trustFile, JSON.stringify(trust));
writeFileSync(policyFile, JSON.stringify(policy));
let roleArn;
try {
  try {
    roleArn = aws(['iam', 'get-role', '--role-name', roleName]).Role.Arn;
  } catch (error) {
    if (!String(error.stderr).includes('NoSuchEntity')) throw error;
  }
  if (roleArn)
    aws([
      'iam',
      'update-assume-role-policy',
      '--role-name',
      roleName,
      '--policy-document',
      `file://${trustFile}`,
    ]);
  else
    roleArn = aws([
      'iam',
      'create-role',
      '--role-name',
      roleName,
      '--assume-role-policy-document',
      `file://${trustFile}`,
      '--max-session-duration',
      '3600',
    ]).Role.Arn;
  aws([
    'iam',
    'put-role-policy',
    '--role-name',
    roleName,
    '--policy-name',
    'DeployExistingSkylineApplication',
    '--policy-document',
    `file://${policyFile}`,
  ]);
} finally {
  unlinkSync(trustFile);
  unlinkSync(policyFile);
}
for (const [name, value] of Object.entries({
  AWS_DEPLOY_ROLE_ARN: roleArn,
  AWS_REGION: region,
  AWS_STACK_NAME: stack,
  AWS_ARTIFACT_BUCKET: artifactBucket,
})) {
  execFileSync('gh', ['variable', 'set', name, '--repo', repository, '--body', value], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
console.log(`Configured AWS OIDC and repository variables for ${repository}, branch ${branch}.`);
