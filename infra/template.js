const ref = (name) => ({ Ref: name });
const attr = (name, key) => ({ 'Fn::GetAtt': [name, key] });
const sub = (value) => ({ 'Fn::Sub': value });
const privateBucket = {
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  },
  BucketEncryption: {
    ServerSideEncryptionConfiguration: [
      { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
    ],
  },
};
export const template = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'Skyline custom JWT Express backend and private frontend hosting',
  Parameters: {
    ArtifactBucket: { Type: 'String' },
    ArtifactKey: { Type: 'String' },
    ProviderSecretArn: { Type: 'String' },
    AppOrigin: { Type: 'String', Default: 'https://deployment-pending.invalid' },
  },
  Resources: {
    Data: {
      Type: 'AWS::DynamoDB::Table',
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: {
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        SSESpecification: { SSEEnabled: true },
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
        TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      },
    },
    Frontend: {
      Type: 'AWS::S3::Bucket',
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: privateBucket,
    },
    Receipts: {
      Type: 'AWS::S3::Bucket',
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: {
        ...privateBucket,
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedOrigins: [ref('AppOrigin')],
              AllowedMethods: ['POST'],
              AllowedHeaders: ['*'],
              MaxAge: 300,
            },
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'AbortIncompleteUploads',
              Status: 'Enabled',
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
            },
          ],
        },
      },
    },
    Api: {
      Type: 'AWS::ApiGatewayV2::Api',
      Properties: { Name: sub('${AWS::StackName}-api'), ProtocolType: 'HTTP' },
    },
    ApiStage: {
      Type: 'AWS::ApiGatewayV2::Stage',
      Properties: {
        ApiId: ref('Api'),
        StageName: '$default',
        AutoDeploy: true,
        DefaultRouteSettings: { ThrottlingBurstLimit: 50, ThrottlingRateLimit: 25 },
      },
    },
    ApiIntegration: {
      Type: 'AWS::ApiGatewayV2::Integration',
      Properties: {
        ApiId: ref('Api'),
        IntegrationType: 'AWS_PROXY',
        IntegrationUri: attr('Backend', 'Arn'),
        PayloadFormatVersion: '2.0',
        TimeoutInMillis: 29000,
      },
    },
    ApiRoute: {
      Type: 'AWS::ApiGatewayV2::Route',
      Properties: {
        ApiId: ref('Api'),
        RouteKey: '$default',
        Target: { 'Fn::Join': ['/', ['integrations', ref('ApiIntegration')]] },
      },
    },
    ApiInvoke: {
      Type: 'AWS::Lambda::Permission',
      Properties: {
        Action: 'lambda:InvokeFunction',
        FunctionName: ref('Backend'),
        Principal: 'apigateway.amazonaws.com',
        SourceArn: sub(
          'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${Api}/*',
        ),
      },
    },
    BackendRole: {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole',
            },
          ],
        },
        Policies: [
          {
            PolicyName: 'SkylineResources',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:Query',
                    'dynamodb:TransactWriteItems',
                  ],
                  Resource: attr('Data', 'Arn'),
                },
                {
                  Effect: 'Allow',
                  Action: ['s3:GetObject', 's3:PutObject'],
                  Resource: sub('${Receipts.Arn}/skyline-campus/*'),
                },
                {
                  Effect: 'Allow',
                  Action: 'secretsmanager:GetSecretValue',
                  Resource: ref('ProviderSecretArn'),
                },
                {
                  Effect: 'Allow',
                  Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                  Resource: sub(
                    'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-backend:*',
                  ),
                },
              ],
            },
          },
        ],
      },
    },
    BackendLogs: {
      Type: 'AWS::Logs::LogGroup',
      Properties: {
        LogGroupName: sub('/aws/lambda/${AWS::StackName}-backend'),
        RetentionInDays: 14,
      },
    },
    Backend: {
      Type: 'AWS::Lambda::Function',
      DependsOn: 'BackendLogs',
      Properties: {
        FunctionName: sub('${AWS::StackName}-backend'),
        Runtime: 'nodejs22.x',
        Architectures: ['arm64'],
        Handler: 'lambda.handler',
        MemorySize: 512,
        Timeout: 28,
        ReservedConcurrentExecutions: 5,
        Role: attr('BackendRole', 'Arn'),
        Code: { S3Bucket: ref('ArtifactBucket'), S3Key: ref('ArtifactKey') },
        Environment: {
          Variables: {
            NODE_ENV: 'production',
            DATA_TABLE: ref('Data'),
            RECEIPTS_BUCKET: ref('Receipts'),
            PROVIDER_SECRET_ARN: ref('ProviderSecretArn'),
            APP_ORIGIN: ref('AppOrigin'),
          },
        },
      },
    },
    OriginAccess: {
      Type: 'AWS::CloudFront::OriginAccessControl',
      Properties: {
        OriginAccessControlConfig: {
          Name: sub('${AWS::StackName}-oac'),
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4',
        },
      },
    },
    Router: {
      Type: 'AWS::CloudFront::Function',
      Properties: {
        Name: sub('${AWS::StackName}-spa'),
        AutoPublish: true,
        FunctionConfig: {
          Comment: 'Rewrite React routes while preserving API and asset requests',
          Runtime: 'cloudfront-js-2.0',
        },
        FunctionCode:
          "function handler(event) { var request = event.request; if (request.uri.indexOf('/api') !== 0 && request.uri.split('/').pop().indexOf('.') === -1) request.uri = '/index.html'; return request; }",
      },
    },
    SecurityHeaders: {
      Type: 'AWS::CloudFront::ResponseHeadersPolicy',
      Properties: {
        ResponseHeadersPolicyConfig: {
          Name: sub('${AWS::StackName}-headers'),
          SecurityHeadersConfig: {
            ContentTypeOptions: { Override: true },
            FrameOptions: { FrameOption: 'DENY', Override: true },
            StrictTransportSecurity: {
              AccessControlMaxAgeSec: 31536000,
              IncludeSubdomains: true,
              Override: true,
            },
            ReferrerPolicy: { ReferrerPolicy: 'same-origin', Override: true },
          },
        },
      },
    },
    Distribution: {
      Type: 'AWS::CloudFront::Distribution',
      Properties: {
        DistributionConfig: {
          Enabled: true,
          DefaultRootObject: 'index.html',
          HttpVersion: 'http2and3',
          PriceClass: 'PriceClass_200',
          IPV6Enabled: true,
          Origins: [
            {
              Id: 'frontend',
              DomainName: attr('Frontend', 'RegionalDomainName'),
              OriginAccessControlId: ref('OriginAccess'),
              S3OriginConfig: { OriginAccessIdentity: '' },
            },
            {
              Id: 'api',
              DomainName: sub('${Api}.execute-api.${AWS::Region}.amazonaws.com'),
              CustomOriginConfig: {
                OriginProtocolPolicy: 'https-only',
                OriginSSLProtocols: ['TLSv1.2'],
              },
            },
          ],
          DefaultCacheBehavior: {
            TargetOriginId: 'frontend',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            Compress: true,
            CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
            ResponseHeadersPolicyId: ref('SecurityHeaders'),
            FunctionAssociations: [
              { EventType: 'viewer-request', FunctionARN: attr('Router', 'FunctionARN') },
            ],
          },
          CacheBehaviors: [
            {
              PathPattern: '/api/*',
              TargetOriginId: 'api',
              ViewerProtocolPolicy: 'https-only',
              AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
              OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
              ResponseHeadersPolicyId: ref('SecurityHeaders'),
            },
          ],
        },
      },
    },
    FrontendPolicy: {
      Type: 'AWS::S3::BucketPolicy',
      Properties: {
        Bucket: ref('Frontend'),
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'cloudfront.amazonaws.com' },
              Action: 's3:GetObject',
              Resource: sub('${Frontend.Arn}/*'),
              Condition: {
                StringEquals: {
                  'AWS:SourceArn': sub(
                    'arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}',
                  ),
                },
              },
            },
          ],
        },
      },
    },
  },
  Outputs: {
    WebsiteUrl: { Value: sub('https://${Distribution.DomainName}') },
    DistributionId: { Value: ref('Distribution') },
    ApiUrl: { Value: attr('Api', 'ApiEndpoint') },
    DataTable: { Value: ref('Data') },
    FrontendBucket: { Value: ref('Frontend') },
    ReceiptsBucket: { Value: ref('Receipts') },
    BackendFunction: { Value: ref('Backend') },
  },
};
export function apiHostingTemplate() {
  const fallback = structuredClone(template);
  fallback.Description =
    'Skyline JWT Express API and HTTPS static site hosted by API Gateway and Lambda';
  for (const name of [
    'Distribution',
    'FrontendPolicy',
    'OriginAccess',
    'Router',
    'SecurityHeaders',
  ])
    delete fallback.Resources[name];
  delete fallback.Outputs.DistributionId;
  delete fallback.Resources.Backend.Properties.ReservedConcurrentExecutions;
  fallback.Outputs.WebsiteUrl = { Value: attr('Api', 'ApiEndpoint') };
  return fallback;
}
