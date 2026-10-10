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
  MEMBERSHIP_FEE,
} from '../../src/modules/commerce/commerce.domain.js';

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
