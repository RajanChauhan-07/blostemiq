import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // LocalStack endpoint in dev
  ...(process.env.LOCALSTACK_ENDPOINT && {
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
});

export const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true },
});

export const TABLES = {
  PARTNER_EVENTS: `blostemiq-${process.env.ENVIRONMENT || 'dev'}-partner-events`,
  ACTIVITY_FEED:  `blostemiq-${process.env.ENVIRONMENT || 'dev'}-activity-feed`,
  ALERT_HISTORY:  `blostemiq-${process.env.ENVIRONMENT || 'dev'}-alert-history`,
} as const;
