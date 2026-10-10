import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { HttpError } from '../../shared/records.js';
import { parseDatabaseRecord } from '../schemas/index.js';

export class DynamoRepository {
  constructor(
    table,
    client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {
    this.table = table;
    this.client = client;
  }
  async get(pk, sk) {
    return (
      await this.client.send(
        new GetCommand({ TableName: this.table, Key: { pk, sk }, ConsistentRead: true }),
      )
    ).Item;
  }
  async put(item, fresh = false) {
    item = parseDatabaseRecord(item);
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: item,
          ...(fresh ? { ConditionExpression: 'attribute_not_exists(pk)' } : {}),
        }),
      );
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }
  async list(pk, prefix) {
    const items = [];
    let last;
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
          ExclusiveStartKey: last,
          ConsistentRead: true,
        }),
      );
      items.push(...result.Items);
      last = result.LastEvaluatedKey;
    } while (last);
    return items;
  }
  async atomic(items) {
    items = items.map((operation) => ({ ...operation, item: parseDatabaseRecord(operation.item) }));
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: items.map(({ item, condition, names, values }) => ({
            Put: {
              TableName: this.table,
              Item: item,
              ConditionExpression: condition,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            },
          })),
        }),
      );
      return true;
    } catch (error) {
      if (
        error.name === 'TransactionCanceledException' &&
        error.CancellationReasons?.some((r) => r.Code === 'ConditionalCheckFailed')
      )
        return false;
      throw error;
    }
  }
  async limit(key, maximum, seconds) {
    if (
      typeof key !== 'string' ||
      !key ||
      !Number.isInteger(maximum) ||
      maximum < 1 ||
      !Number.isInteger(seconds) ||
      seconds < 1
    )
      throw new TypeError('Invalid rate-limit parameters.');
    const pk = `LIMIT#${key}#${Math.floor(Date.now() / (seconds * 1000))}`;
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk, sk: 'COUNT' },
          UpdateExpression: 'SET expiresAt = :ttl ADD #count :one',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :maximum',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':maximum': maximum,
            ':ttl': Math.floor(Date.now() / 1000) + seconds * 2,
          },
        }),
      );
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException')
        throw new HttpError(429, 'Too many requests. Please try again later.');
      throw error;
    }
  }
  async commit(pk, version, data, audit, request, extraOperations = []) {
    if (Buffer.byteLength(JSON.stringify(data)) > 300_000)
      throw new HttpError(
        409,
        'This club has reached its pilot data limit. Archive records before adding more.',
      );
    return this.atomic([
      ...extraOperations,
      {
        item: { pk, sk: 'STATE', version: version + 1, data },
        condition: '#version = :version',
        names: { '#version': 'version' },
        values: { ':version': version },
      },
      {
        item: { pk, sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
        condition: 'attribute_not_exists(pk)',
      },
      {
        item: {
          pk,
          sk: request.sk,
          result: request.result,
          fingerprint: request.fingerprint,
          expiresAt: Math.floor(Date.now() / 1000) + 86400,
        },
        condition: 'attribute_not_exists(pk)',
      },
    ]);
  }
}
