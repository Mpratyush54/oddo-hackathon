import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const timestamp = () => new Date().toISOString();
export const dateToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const recordId = (prefix) => `${prefix}-${randomUUID()}`;
export const clubKey = (id) => `COLLEGE#skyline-campus#CLUB#${id}`;
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
  async commit(pk, version, data, audit, request) {
    if (Buffer.byteLength(JSON.stringify(data)) > 300_000)
      throw new HttpError(
        409,
        'This club has reached its pilot data limit. Archive records before adding more.',
      );
    const operations = [
      {
        Put: {
          TableName: this.table,
          Item: { pk, sk: 'STATE', version: version + 1, data },
          ConditionExpression: '#version = :version',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: { ':version': version },
        },
      },
      {
        Put: {
          TableName: this.table,
          Item: { pk, sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      {
        Put: {
          TableName: this.table,
          Item: {
            pk,
            sk: request.sk,
            result: request.result,
            fingerprint: request.fingerprint,
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
    ];
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: operations }));
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
}

// Used by meaningful concurrency tests; production always uses DynamoDB.
export class MemoryRepository {
  constructor() {
    this.items = new Map();
  }
  async get(pk, sk) {
    return structuredClone(this.items.get(`${pk}|${sk}`));
  }
  async put(item, fresh = false) {
    const key = `${item.pk}|${item.sk}`;
    if (fresh && this.items.has(key)) return false;
    this.items.set(key, structuredClone(item));
    return true;
  }
  async list(pk, prefix) {
    return [...this.items.values()]
      .filter((i) => i.pk === pk && i.sk.startsWith(prefix))
      .map((i) => structuredClone(i));
  }
  async atomic(items) {
    for (const { item, condition, values } of items) {
      const existing = this.items.get(`${item.pk}|${item.sk}`);
      if (condition === 'attribute_not_exists(pk)' && existing) return false;
      if (condition === 'revoked = :false' && existing?.revoked !== false) return false;
      if (
        condition === 'sessionVersion = :version' &&
        existing?.sessionVersion !== values[':version']
      )
        return false;
    }
    for (const { item } of items) this.items.set(`${item.pk}|${item.sk}`, structuredClone(item));
    return true;
  }
  async limit(key, maximum, seconds) {
    const pk = `LIMIT#${key}#${Math.floor(Date.now() / (seconds * 1000))}`;
    const item = await this.get(pk, 'COUNT');
    if ((item?.count || 0) >= maximum) throw new HttpError(429, 'Too many requests.');
    await this.put({ pk, sk: 'COUNT', count: (item?.count || 0) + 1 });
  }
  async commit(pk, version, data, audit, request) {
    const current = this.items.get(`${pk}|STATE`);
    if (current?.version !== version || this.items.has(`${pk}|${request.sk}`)) return false;
    this.items.set(`${pk}|STATE`, structuredClone({ pk, sk: 'STATE', version: version + 1, data }));
    this.items.set(
      `${pk}|${request.sk}`,
      structuredClone({
        pk,
        sk: request.sk,
        result: request.result,
        fingerprint: request.fingerprint,
      }),
    );
    this.items.set(
      `${pk}|AUDIT#${audit.id}`,
      structuredClone({ pk, sk: `AUDIT#${audit.id}`, ...audit }),
    );
    return true;
  }
}
