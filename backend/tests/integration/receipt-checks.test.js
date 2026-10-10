import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { createDomain } from '../../src/modules/clubs/club.service.js';
import { ReceiptChecksService } from '../../src/modules/finance/receipt-checks.service.js';
import { analyzeReceipt, parseReceiptAmount } from '../../src/modules/finance/receipt-analysis.js';
import { clubKey, recordId } from '../../src/shared/records.js';
const user = { id: 'volunteer', name: 'Test Volunteer', email: 'volunteer@example.test' };
const admin = { id: 'administrator', name: 'Test Administrator', email: 'admin@example.test' };
const field = (type, text, confidence = 99) => ({
  Type: { Text: type, Confidence: confidence },
  ValueDetection: { Text: text, Confidence: confidence },
});
const document = (total = '123.45') => ({
  ExpenseIndex: 1,
  SummaryFields: [
    { ...field('TOTAL', total), Currency: { Code: 'INR' } },
    field('VENDOR_NAME', 'QA Supplies'),
    field('INVOICE_RECEIPT_DATE', '2026-10-01'),
    field('INVOICE_RECEIPT_ID', 'QA-001'),
  ],
});
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
async function fixture() {
  const repo = new MemoryRepository();
  const data = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'))
    .clubs.skyline;
  data.transactions = [];
  await repo.put({ pk: clubKey('skyline'), sk: 'STATE', version: 1, data });
  await repo.put({
    pk: 'USER#' + admin.id,
    sk: 'ACCESS#skyline',
    clubId: 'skyline',
    role: 'admin',
  });
  const domain = createDomain({ repo, clubs: [{ id: 'skyline' }], receiptChecksRequired: true });
  const objects = new Map();
  let starts = 0;
  let result = { status: 'SUCCEEDED', documents: [document()] };
  const s3 = {
    send: async (command) => {
      const { Key, Body, ContentType, IfNoneMatch } = command.input;
      if (command.constructor.name === 'PutObjectCommand') {
        assert.equal(IfNoneMatch, '*');
        if (objects.has(Key)) throw Error('PreconditionFailed');
        objects.set(Key, { bytes: Buffer.from(Body), type: ContentType });
        return {};
      }
      const object = objects.get(Key);
      if (!object) throw Error('NotFound');
      if (command.constructor.name === 'HeadObjectCommand')
        return { ContentType: object.type, ContentLength: object.bytes.length };
      return { ContentType: object.type, Body: { transformToByteArray: async () => object.bytes } };
    },
  };
  const ocr = {
    start: async () => {
      starts++;
      return 'job-' + starts;
    },
    result: async () => result,
  };
  const service = new ReceiptChecksService({
    env: { RECEIPTS_BUCKET: 'qa' },
    repo,
    domain,
    s3,
    ocr,
  });
  const upload = (bytes = Buffer.concat([png, Buffer.from('fixture receipt')])) => {
    const id = recordId('RECEIPT'),
      key = `skyline-campus/skyline/${user.id}/${id}`;
    objects.set(key, { bytes, type: 'image/png' });
    return { id, key };
  };
  const check = async (amount = 123.45, bytes) => {
    const { id, key } = upload(bytes);
    await service.start('skyline', { receiptKey: key, amount }, user);
    return service.status('skyline', id, user);
  };
  const expense = (receipt) => ({
    type: 'expenses.create',
    args: {
      title: 'Supplies',
      amount: receipt.claimedAmount / 100,
      receipt: 'receipt.png',
      receiptKey: receipt.receiptKey,
      receiptCheckId: receipt.id,
    },
    idempotencyKey: crypto.randomUUID(),
  });
  return {
    repo,
    domain,
    service,
    objects,
    upload,
    check,
    expense,
    ocr,
    setResult: (value) => {
      result = value;
    },
    starts: () => starts,
  };
}
test('OCR amount parsing and confidence checks fail closed', () => {
  assert.equal(parseReceiptAmount('₹ 1,23,456.78'), 12345678);
  assert.equal(parseReceiptAmount('Rs. 1,234.50'), 123450);
  for (const value of ['1,0', '12.345', '100 or 200', '-10', '1e6', '1.234,56'])
    assert.equal(parseReceiptAmount(value), undefined);
  assert.deepEqual(analyzeReceipt([document()], 12345).issues, []);
  assert.ok(
    analyzeReceipt([document('200.00')], 12345).issues.some((reason) =>
      reason.includes('claimed amount'),
    ),
  );
  const blurred = document();
  blurred.SummaryFields[0].ValueDetection.Confidence = 30;
  assert.ok(
    analyzeReceipt([blurred], 12345).issues.some((reason) => reason.includes('clearer scan')),
  );
  assert.ok(analyzeReceipt([document()], 12345, true).issues.length);
});
test('receipt checks freeze the uploaded bytes and retrying start does not run another OCR job', async () => {
  const f = await fixture(),
    { id, key } = f.upload();
  await f.service.start('skyline', { receiptKey: key, amount: 123.45 }, user);
  await f.service.start('skyline', { receiptKey: key, amount: 123.45 }, user);
  assert.equal(f.starts(), 1);
  const receipt = await f.service.status('skyline', id, user);
  assert.equal(receipt.status, 'Ready');
  const frozen = f.objects.get(receipt.receiptKey).bytes;
  f.objects.set(key, {
    bytes: Buffer.concat([png, Buffer.from('edited after checking')]),
    type: 'image/png',
  });
  assert.deepEqual(f.objects.get(receipt.receiptKey).bytes, frozen);
  await assert.rejects(
    f.service.start('skyline', { receiptKey: key, amount: 1 }, user),
    (error) => error.status === 409,
  );
});
test('unchecked, processing, changed amount and another owner cannot submit for review', async () => {
  const f = await fixture();
  await assert.rejects(
    f.domain.execute(
      'skyline',
      {
        type: 'expenses.create',
        args: {
          title: 'Supplies',
          amount: 123.45,
          receipt: 'a.png',
          receiptKey: 'skyline-campus/skyline/volunteer/raw',
        },
        idempotencyKey: crypto.randomUUID(),
      },
      user,
    ),
    (error) => error.status === 400,
  );
  const { id, key } = f.upload();
  const processing = await f.service.start('skyline', { receiptKey: key, amount: 123.45 }, user);
  const record = await f.repo.get(clubKey('skyline'), 'RECEIPT#' + id);
  await assert.rejects(
    f.domain.execute('skyline', f.expense({ ...processing, receiptKey: record.receiptKey }), user),
    (error) => error.status === 409,
  );
  const receipt = await f.service.status('skyline', id, user),
    action = f.expense(receipt);
  await assert.rejects(
    f.domain.execute('skyline', { ...action, args: { ...action.args, amount: 1 } }, user),
    (error) => error.status === 409,
  );
  await assert.rejects(
    f.domain.execute('skyline', action, { ...user, id: 'other' }),
    (error) => error.status === 400,
  );
  assert.equal((await f.domain.load('skyline')).data.transactions.length, 0);
});
test('submission consumes clearance atomically; duplicate retry issues exactly one pending expense', async () => {
  const f = await fixture(),
    receipt = await f.check(),
    action = f.expense(receipt);
  await Promise.all([
    f.domain.execute('skyline', action, user),
    f.domain.execute('skyline', action, user),
  ]);
  const data = (await f.domain.load('skyline')).data;
  assert.equal(data.transactions.length, 1);
  assert.equal(data.transactions[0].status, 'Pending');
  assert.equal((await f.repo.get(clubKey('skyline'), 'RECEIPT#' + receipt.id)).status, 'Consumed');
  await assert.rejects(
    f.domain.execute('skyline', f.expense(receipt), user),
    (error) => error.status === 409,
  );
  await f.domain.execute(
    'skyline',
    {
      type: 'expenses.review',
      args: { transactionId: data.transactions[0].id, status: 'Completed' },
      idempotencyKey: crypto.randomUUID(),
    },
    admin,
  );
});
test('two checked copies of the same receipt cannot become two expenses', async () => {
  const f = await fixture(),
    first = await f.check(),
    second = await f.check();
  const results = await Promise.allSettled([
    f.domain.execute('skyline', f.expense(first), user),
    f.domain.execute('skyline', f.expense(second), user),
  ]);
  assert.equal(results.filter((value) => value.status === 'fulfilled').length, 1);
  assert.equal((await f.domain.load('skyline')).data.transactions.length, 1);
});
test('flags require another administrator, a reason and an audit before submission', async () => {
  const f = await fixture();
  f.setResult({ status: 'SUCCEEDED', documents: [document('200.00')] });
  const receipt = await f.check();
  assert.equal(receipt.status, 'NeedsReview');
  const record = await f.repo.get(clubKey('skyline'), 'RECEIPT#' + receipt.id);
  await assert.rejects(
    f.domain.execute('skyline', f.expense({ ...receipt, receiptKey: record.receiptKey }), user),
    (error) => error.status === 409,
  );
  await f.repo.put({
    pk: 'USER#' + user.id,
    sk: 'ACCESS#skyline',
    clubId: 'skyline',
    role: 'admin',
  });
  await assert.rejects(
    f.service.clear(
      'skyline',
      receipt.id,
      { reason: 'Only a portion of this receipt is claimed.' },
      user,
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    f.service.clear('skyline', receipt.id, { reason: 'ok' }, admin),
    (error) => error.status === 400,
  );
  const cleared = await f.service.clear(
    'skyline',
    receipt.id,
    { reason: 'Receipt inspected. Only the club portion is claimed.' },
    admin,
  );
  assert.equal(cleared.status, 'Ready');
  assert.equal((await f.repo.list(clubKey('skyline'), 'AUDIT#')).length, 1);
  await f.domain.execute('skyline', f.expense(cleared), user);
});
test('different scans with the same vendor invoice cannot be reimbursed twice', async () => {
  const f = await fixture(),
    first = await f.check();
  await f.domain.execute('skyline', f.expense(first), user);
  const second = await f.check(
    123.45,
    Buffer.concat([png, Buffer.from('another photo of same invoice')]),
  );
  assert.equal(second.status, 'NeedsReview');
  const cleared = await f.service.clear(
    'skyline',
    second.id,
    { reason: 'Inspected alternative scan of the uploaded receipt.' },
    admin,
  );
  await assert.rejects(
    f.domain.execute('skyline', f.expense(cleared), user),
    (error) => error.status === 409,
  );
});
test('OCR failure and misleading file format never unlock expense submission', async () => {
  const f = await fixture(),
    { key } = f.upload(Buffer.from('this is not a png'));
  await assert.rejects(
    f.service.start('skyline', { receiptKey: key, amount: 123.45 }, user),
    (error) => error.status === 400,
  );
  f.setResult({ status: 'FAILED', documents: [] });
  const receipt = await f.check();
  assert.equal(receipt.status, 'Failed');
  await assert.rejects(
    f.service.clear(
      'skyline',
      receipt.id,
      { reason: 'Please bypass the failed OCR operation.' },
      admin,
    ),
    (error) => error.status === 409,
  );
});
