import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { DynamoRepository } from '../../src/database/repositories/dynamo.repository.js';
import { parseDatabaseRecord, DatabaseValidationError } from '../../src/database/schemas/index.js';
import { databaseJsonSchema } from '../../src/database/schemas/json-schema.js';
import { clubKey } from '../../src/shared/records.js';

const seed = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));
const state = () => ({
  pk: clubKey('skyline'),
  sk: 'STATE',
  version: 1,
  data: structuredClone(seed.clubs.skyline),
});
const access = () => ({
  pk: 'USER#USR-one',
  sk: 'ACCESS#skyline',
  clubId: 'skyline',
  role: 'member',
});

test('seed records are compatible and published JSON Schema matches runtime contracts', () => {
  for (const [clubId, data] of Object.entries(seed.clubs))
    assert.equal(
      parseDatabaseRecord({ pk: clubKey(clubId), sk: 'STATE', version: 1, data }).schemaVersion,
      1,
    );
  const published = JSON.parse(
    readFileSync(new URL('../../database/schema.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(published, databaseJsonSchema());
});

test('storage rejects forged roles, key mismatches, plaintext credentials and malformed sessions', () => {
  for (const item of [
    { ...access(), role: 'superadmin' },
    { ...access(), sk: 'ACCESS#canvas' },
    { pk: 'ACCOUNT#' + 'a'.repeat(64), sk: 'ACCOUNT', id: 'USR-one', passwordHash: 'plaintext' },
    {
      pk: 'SESSION#S1',
      sk: 'SESSION',
      userId: 'USR-one',
      sessionVersion: 1,
      csrfToken: 'short',
      revoked: false,
      expiresAt: 2000000000,
    },
    { pk: 'USER#USR-one', sk: 'UNDECLARED', value: 'unknown' },
  ])
    assert.throws(() => parseDatabaseRecord(item), DatabaseValidationError);
});

test('storage rejects negative stock, duplicate IDs, over-capacity events and non-finite prices', () => {
  const variations = [
    (s) => {
      s.data.products[0].stock.M = -1;
    },
    (s) => {
      s.data.events.push(structuredClone(s.data.events[0]));
    },
    (s) => {
      s.data.events[0].sold = s.data.events[0].capacity + 1;
    },
    (s) => {
      s.data.events[0].price = Infinity;
    },
    (s) => {
      s.data.events[0].price = -100;
    },
  ];
  for (const mutate of variations) {
    const item = state();
    mutate(item);
    assert.throws(() => parseDatabaseRecord(item), DatabaseValidationError);
  }
});

test('both repository adapters validate the entire transaction before any database write', async () => {
  let requests = 0;
  const dynamo = new DynamoRepository('test-table', {
    send: async () => {
      requests++;
      return {};
    },
  });
  const memory = new MemoryRepository();
  const badState = state();
  badState.data.products[0].stock.M = -1;
  for (const repo of [memory, dynamo]) {
    await assert.rejects(
      repo.atomic([{ item: access() }, { item: badState }]),
      DatabaseValidationError,
    );
    await assert.rejects(repo.put(badState), DatabaseValidationError);
  }
  assert.equal(requests, 0);
  assert.equal(await memory.get('USER#USR-one', 'ACCESS#skyline'), undefined);
});

test('idempotency records omit optional undefined properties and reject non-JSON values', () => {
  const record = {
    pk: clubKey('skyline'),
    sk: 'REQUEST#USR-one#request-123',
    fingerprint: 'a'.repeat(64),
    result: { orders: [{ id: 'ORD-one', promoCode: undefined }] },
    expiresAt: 2000000000,
  };
  assert.deepEqual(parseDatabaseRecord(record).result, { orders: [{ id: 'ORD-one' }] });
  assert.throws(
    () => parseDatabaseRecord({ ...record, result: { amount: NaN } }),
    DatabaseValidationError,
  );
});

test('rate counters have TTL and invalid parameters cannot issue database commands', async () => {
  const repo = new MemoryRepository();
  await repo.limit('TEST', 1, 60);
  const counter = [...repo.items.values()][0];
  assert.ok(counter.expiresAt > Date.now() / 1000);
  assert.equal(counter.schemaVersion, 1);
  await assert.rejects(repo.limit('TEST', 1, 60), (error) => error.status === 429);
  await assert.rejects(repo.limit('TEST', 0, 60), TypeError);
});
