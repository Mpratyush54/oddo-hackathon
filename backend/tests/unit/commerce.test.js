import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustInventory,
  awardPoints,
  cancelTicket,
  ensureCommerceFields,
  joinWaitlist,
  placeOrder,
  quotePromo,
  updateProduct,
  deleteProduct,
  MEMBERSHIP_FEE,
  savePointRules,
  updateOrderStatus,
} from '../../src/modules/commerce/commerce.domain.js';
import { availablePoints } from '../../../shared/points.js';

const baseStore = () =>
  ensureCommerceFields({
    members: [
      {
        id: 'MEM-005',
        name: 'Aisha Patel',
        email: 'aisha@skyline.edu',
        course: 'Economics',
        status: 'Active',
        joined: '2026-09-02',
        expires: '2027-07-31',
        role: 'Volunteer',
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      },
      {
        id: 'MEM-G',
        name: 'Guest Student',
        email: 'guest@skyline.edu',
        course: 'Design',
        status: 'Pending',
        joined: '2026-10-10',
        expires: '2027-07-31',
        role: 'Volunteer',
      },
    ],
    events: [
      {
        id: 'EVT-001',
        title: 'Gala',
        date: '2026-10-24',
        time: '18:00',
        venue: 'Hall',
        category: 'Social',
        price: 750,
        memberPrice: 500,
        capacity: 2,
        sold: 2,
        description: 'Full',
        image: '',
      },
    ],
    products: [
      {
        id: 'PROD-001',
        name: 'The everyday hoodie',
        type: 'Hoodie',
        price: 1200,
        memberPrice: 999,
        color: 'teal',
        stock: { S: 8, M: 2 },
      },
    ],
    tickets: [
      {
        id: 'SKY-1',
        eventId: 'EVT-001',
        name: 'Aisha Patel',
        email: 'aisha@skyline.edu',
        member: true,
        checkedIn: false,
        amount: 500,
        status: 'Confirmed',
      },
      {
        id: 'SKY-2',
        eventId: 'EVT-001',
        name: 'Other',
        email: 'other@skyline.edu',
        member: false,
        checkedIn: false,
        amount: 750,
        status: 'Confirmed',
      },
    ],
    waitlist: [
      {
        id: 'WAIT-1',
        eventId: 'EVT-001',
        name: 'Wait One',
        email: 'wait1@skyline.edu',
        joined: '2026-10-01T10:00:00.000Z',
        status: 'Waiting',
      },
      {
        id: 'WAIT-2',
        eventId: 'EVT-001',
        name: 'Wait Two',
        email: 'wait2@skyline.edu',
        joined: '2026-10-02T10:00:00.000Z',
        status: 'Waiting',
      },
    ],
    orders: [],
    transactions: [],
    notifications: [],
    audit: [],
    promos: undefined,
    pointLedger: [],
  });

test('admin redemption rate applies after coupons; wallet and earned scores stay separate', () => {
  const store = baseStore();
  store.members[0].participationPoints = 5000;
  Object.assign(
    store,
    savePointRules(store, {
      rules: { ...store.pointRules, redemptionValuePaise: 25 },
      actor: { name: 'Admin' },
    }).patch,
  );
  const quote = quotePromo(store, {
    code: 'WELCOME10',
    productId: 'PROD-001',
    quantity: 1,
    pointsToRedeem: 5000,
    email: 'aisha@skyline.edu',
  });
  assert.equal(quote.promoDiscount, 100);
  assert.equal(quote.pointsRedeemed, 3596);
  assert.equal(quote.pointsDiscount, 899);
  const result = placeOrder(store, {
    productId: 'PROD-001',
    size: 'S',
    quantity: 1,
    promoCode: 'WELCOME10',
    pointsToRedeem: 5000,
    actor: { name: 'Aisha', email: 'aisha@skyline.edu' },
  });
  assert.equal(result.total, 0);
  assert.equal(result.patch.members[0].participationPoints, 5000);
  assert.equal(result.patch.members[0].contributionPoints, 0);
  assert.equal(availablePoints(result.patch.members[0], result.patch.pointLedger), 1404);
  const cancelled = updateOrderStatus(
    { ...store, ...result.patch },
    { orderId: result.order.id, status: 'Cancelled', actor: { name: 'Admin' } },
  );
  assert.equal(availablePoints(result.patch.members[0], cancelled.patch.pointLedger), 5000);
  assert.equal(cancelled.patch.products[0].stock.S, 8);
  assert.deepEqual(
    updateOrderStatus(
      { ...store, ...cancelled.patch },
      { orderId: result.order.id, status: 'Cancelled' },
    ).patch,
    {},
  );
});

test('redemption rejects insufficient balances, disabled rules and invalid quantities, excludes joining fees', () => {
  const store = baseStore();
  const args = {
    productId: 'PROD-001',
    quantity: 1,
    email: 'aisha@skyline.edu',
    pointsToRedeem: 1,
  };
  assert.throws(() => quotePromo(store, args), /points available/);
  store.members[0].participationPoints = 10;
  store.pointRules.redemptionEnabled = false;
  assert.throws(() => quotePromo(store, args), /disabled/);
  store.pointRules.redemptionEnabled = true;
  for (const pointsToRedeem of [-1, 0.5, '1', 1000001])
    assert.throws(() => quotePromo(store, { ...args, pointsToRedeem }));
  store.members[1].volunteerPoints = 2000;
  const order = placeOrder(store, {
    productId: 'PROD-001',
    size: 'S',
    quantity: 1,
    joinMembership: true,
    pointsToRedeem: 2000,
    actor: { name: 'Guest', email: 'guest@skyline.edu' },
  });
  assert.equal(order.total, 500);
  assert.equal(order.pointsRedeemed, 999);
});

test('cancelTicket auto-promotes the oldest waitlist entry', () => {
  const result = cancelTicket(baseStore(), { ticketId: 'SKY-1', actor: { id: 'MEM-005' } });
  assert.equal(result.promoted.email, 'wait1@skyline.edu');
  assert.equal(result.patch.waitlist.find((w) => w.id === 'WAIT-1').status, 'Promoted');
  assert.equal(result.patch.tickets.find((t) => t.id === 'SKY-1').status, 'Cancelled');
  assert.equal(result.patch.events[0].sold, 2);
  assert.match(result.patch.notifications[0].body, /waitlist offer/);
});

test('joinWaitlist rejects when seats remain', () => {
  const store = baseStore();
  store.events[0].sold = 1;
  assert.throws(
    () => joinWaitlist(store, { eventId: 'EVT-001', name: 'X', email: 'x@skyline.edu' }),
    (e) => e.status === 400,
  );
});

test('quotePromo and placeOrder apply member rates, promos and inventory', () => {
  const store = baseStore();
  store.audit = [
    {
      id: 'AUD-EXISTING',
      actor: 'Admin',
      action: 'Created',
      entity: 'products',
      date: '2026-10-10',
      detail: 'Existing audit row',
    },
  ];
  const quote = quotePromo(store, {
    code: 'WELCOME10',
    productId: 'PROD-001',
    quantity: 2,
    email: 'aisha@skyline.edu',
  });
  assert.equal(quote.unitPrice, 999);
  assert.equal(quote.discount, Math.round(999 * 2 * 0.1));

  const order = placeOrder(store, {
    productId: 'PROD-001',
    size: 'S',
    quantity: 2,
    promoCode: 'WELCOME10',
    actor: { id: 'MEM-005', name: 'Aisha Patel', email: 'aisha@skyline.edu' },
  });
  assert.equal(order.patch.products[0].stock.S, 6);
  assert.equal(order.orders.length, 2);
  assert.equal(order.promoDiscount, quote.discount);
  assert.ok(order.patch.pointLedger[0].points >= 1);
  assert.equal(order.patch.promos.find((p) => p.code === 'WELCOME10').redemptions, 1);
  assert.equal(order.patch.audit.filter((entry) => entry.id === 'AUD-EXISTING').length, 1);
});

test('non-member can buy membership at checkout for member pricing', () => {
  const order = placeOrder(baseStore(), {
    productId: 'PROD-001',
    size: 'M',
    quantity: 1,
    joinMembership: true,
    actor: { id: 'MEM-G', name: 'Guest Student', email: 'guest@skyline.edu' },
  });
  assert.equal(order.membershipFee, MEMBERSHIP_FEE);
  assert.equal(order.memberPriceApplied, true);
  assert.equal(order.total, 999 + MEMBERSHIP_FEE);
  const member = order.patch.members.find((m) => m.email === 'guest@skyline.edu');
  assert.equal(member.status, 'Active');
  assert.ok(order.patch.transactions.some((t) => t.category === 'Membership'));
});

test('inventory adjustment audits stock changes', () => {
  const result = adjustInventory(baseStore(), {
    productId: 'PROD-001',
    size: 'S',
    delta: -3,
    reason: 'Damaged in transit',
    actor: { name: 'Alex Morgan' },
  });
  assert.equal(result.patch.products[0].stock.S, 5);
  assert.match(result.patch.audit[0].detail, /Damaged/);
});

test('awardPoints updates volunteer balance', () => {
  const result = awardPoints(baseStore(), {
    memberId: 'MEM-005',
    kind: 'volunteer',
    points: 25,
    reason: 'Bake sale shift',
    actor: { name: 'Alex Morgan' },
  });
  assert.equal(result.patch.members.find((m) => m.id === 'MEM-005').volunteerPoints, 25);
  assert.equal(result.patch.pointLedger[0].kind, 'volunteer');
});

test('updateProduct updates details, price, and delisting flag with audit trail', () => {
  const store = baseStore();
  const result = updateProduct(store, {
    id: 'PROD-001',
    name: 'Updated Campus Hoodie',
    price: 999,
    memberPrice: 799,
    delisted: true,
    actor: { name: 'Alex Morgan' },
  });
  const updated = result.patch.products.find((p) => p.id === 'PROD-001');
  assert.equal(updated.name, 'Updated Campus Hoodie');
  assert.equal(updated.price, 999);
  assert.equal(updated.memberPrice, 799);
  assert.equal(updated.delisted, true);
  assert.match(result.patch.audit[0].detail, /Delisted/);
});

test('deleteProduct removes product from collection with audit record', () => {
  const store = baseStore();
  const result = deleteProduct(store, {
    productId: 'PROD-001',
    actor: { name: 'Alex Morgan' },
  });
  assert.equal(
    result.patch.products.some((p) => p.id === 'PROD-001'),
    false,
  );
  assert.match(result.patch.audit[0].detail, /Deleted The everyday hoodie/);
});
