import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDemoData,
  demoCollections,
  mergeDemoData,
  topUpDemoData,
} from '../../../scripts/lib/demo-data.js';
import { seedDemoData, demoReceiptPdf } from '../../../scripts/seed-demo-data.js';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { clubKey } from '../../src/shared/records.js';
import { parseDatabaseRecord } from '../../src/database/schemas/index.js';
import {
  membershipReminder,
  eventReminders,
  weeklyReminders,
} from '../../src/modules/notifications/reminder-planner.js';
import { WhatsAppService } from '../../src/modules/notifications/whatsapp.service.js';
const base = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url)));
const today = '2026-10-11';
const passwordHash = 'scrypt:32768:8:1:' + '1'.repeat(32) + ':' + '2'.repeat(128);
const makeDemo = () => buildDemoData({ organizations: base.organizations, today, passwordHash });
test('demo dataset contains 200 linked rows for every app collection and 200 accounts, refunds and receipt reviews', () => {
  const demo = makeDemo();
  for (const collection of demoCollections)
    assert.equal(
      Object.values(demo.clubs).reduce((n, d) => n + d[collection].length, 0),
      200,
      collection,
    );
  for (const prefix of ['PROFILE', 'ACCOUNT', 'REFUND#', 'RECEIPT#', 'PAYMENT#'])
    assert.equal(demo.records.filter((r) => r.sk.startsWith(prefix)).length, 200, prefix);
  for (const record of demo.records) parseDatabaseRecord(record);
  for (const [id, data] of Object.entries(demo.clubs)) {
    const merged = mergeDemoData(base.clubs[id], data);
    parseDatabaseRecord({ pk: clubKey(id), sk: 'STATE', version: 1, data: merged });
    assert.ok(Buffer.byteLength(JSON.stringify(merged)) < 230000);
    for (const ticket of data.tickets)
      assert.ok(data.events.some((e) => e.id === ticket.eventId && e.sold <= e.capacity));
    for (const order of data.orders) assert.ok(data.products.some((p) => p.id === order.productId));
    for (const entry of data.waitlist)
      assert.ok(data.events.some((e) => e.id === entry.eventId && e.sold === e.capacity));
    for (const member of data.members) {
      assert.equal(member.whatsappOptIn, false);
      assert.equal(member.phone, undefined);
      assert.equal(membershipReminder(member, today), null);
    }
    assert.deepEqual(eventReminders(data, new Date(today + 'T04:30:00Z')), []);
    assert.deepEqual(weeklyReminders(data, new Date(today + 'T04:30:00Z'), today), []);
  }
});
test('seeding preserves existing records and repeated runs neither duplicate nor reset user edits', async () => {
  const repo = new MemoryRepository(),
    demo = makeDemo();
  for (const [id, data] of Object.entries(base.clubs))
    await repo.put({ pk: clubKey(id), sk: 'STATE', version: 1, data });
  assert.equal((await seedDemoData({ repo, base, demo })).apply, false);
  assert.equal(repo.items.size, 3);
  const first = await seedDemoData({ repo, base, demo, apply: true });
  assert.equal(first.createdRecords, 1400);
  const state = await repo.get(clubKey('skyline'), 'STATE');
  state.data.members[0].course = 'Edited course';
  await repo.put(state);
  const second = await seedDemoData({ repo, base, demo: makeDemo(), apply: true });
  assert.equal(second.createdRecords, 0);
  const after = await repo.get(clubKey('skyline'), 'STATE');
  assert.equal(after.data.members[0].course, 'Edited course');
  assert.equal(after.data.members.length, 67);
  assert.deepEqual(after.data.events[0], base.clubs.skyline.events[0]);
});

test('populated-workspace top-up fills missing collections and preserves existing rows and point balances', () => {
  const source = makeDemo();
  const current = structuredClone(source.clubs);
  for (const data of Object.values(current)) {
    for (const collection of demoCollections)
      for (const row of data[collection]) row.id = 'LEGACY-' + row.id;
    data.events = [];
    data.products = [];
    data.projects = [];
  }
  const plan = topUpDemoData(current, source);
  for (const collection of ['tickets', 'transactions', 'orders', 'pointLedger'])
    assert.equal(Object.values(plan.clubs).flatMap((data) => data[collection]).length, 0);
  for (const [clubId, data] of Object.entries(plan.clubs)) {
    assert.ok(
      data.members.every(
        (member) =>
          member.participationPoints + member.volunteerPoints + member.contributionPoints === 0,
      ),
    );
    const merged = mergeDemoData(current[clubId], data);
    for (const collection of demoCollections)
      assert.ok(merged[collection].length >= current[clubId][collection].length);
    assert.deepEqual(merged.tickets, current[clubId].tickets);
    const second = mergeDemoData(
      merged,
      topUpDemoData({ ...current, [clubId]: merged }, source).clubs[clubId],
    );
    assert.deepEqual(second, merged);
  }
});
test('invalid or oversized seed plans make no database writes', async () => {
  const repo = new MemoryRepository();
  for (const [id, data] of Object.entries(base.clubs))
    await repo.put({ pk: clubKey(id), sk: 'STATE', version: 1, data });
  const demo = makeDemo();
  for (const announcement of demo.clubs.skyline.announcements.slice(0, 30))
    announcement.body = 'x'.repeat(8000);
  await assert.rejects(seedDemoData({ repo, base, demo, apply: true }), /No writes/);
  assert.equal(repo.items.size, 3);
});
test('demo receipt is an actual PDF and WhatsApp refuses non-test or missing allowlists before making a request', async () => {
  const receipt = makeDemo().records.find((r) => r.sk.startsWith('RECEIPT#'));
  const pdf = await demoReceiptPdf(receipt);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  let calls = 0;
  const service = new WhatsAppService({
    env: { META_TEST_RECIPIENTS: '919000000001' },
    fetchImpl: async () => {
      calls++;
    },
  });
  const member = { name: 'Demo', whatsappOptIn: true, phone: '+919000000002' };
  assert.equal((await service.send(member, { title: 'Test', body: 'Test' })).status, 'Failed');
  service.env.META_TEST_RECIPIENTS = '';
  member.phone = '';
  assert.equal((await service.send(member, { title: 'Test', body: 'Test' })).status, 'Failed');
  assert.equal(calls, 0);
});
