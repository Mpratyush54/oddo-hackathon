/** Pure commerce calculations shared by the authenticated services and demo API. */
import { parseRequest } from '../../shared/request-validation.js';
import {
  quoteRequestSchema,
  orderRequestSchema,
  inventoryRequestSchema,
  createProductSchema,
  awardPointsSchema,
} from './commerce.schemas.js';

export const MEMBERSHIP_FEE = 500;
export const DEMO_TODAY = '2026-10-10';

export const DEFAULT_POINT_RULES = {
  checkInEnabled: true,
  checkInPoints: 10,
  merchEnabled: true,
  merchRupeesPerPoint: 100,
  taskEnabled: true,
  taskDonePoints: 15,
};

export function resolvePointRules(store) {
  return { ...DEFAULT_POINT_RULES, ...(store?.pointRules || {}) };
}

export const PRODUCT_IMAGES = {
  Hoodie:
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85',
  'T-shirt':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85',
  'Tote bag':
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
};

export const DEFAULT_PROMOS = [
  {
    id: 'PROMO-WELCOME',
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    active: true,
    maxRedemptions: 200,
    redemptions: 0,
    memberOnly: false,
    minSubtotal: 0,
    description: '10% off merchandise for everyone',
  },
  {
    id: 'PROMO-MEMBER',
    code: 'MEMBER50',
    type: 'fixed',
    value: 50,
    active: true,
    maxRedemptions: 100,
    redemptions: 0,
    memberOnly: true,
    minSubtotal: 400,
    description: '₹50 off for active members (min ₹400)',
  },
  {
    id: 'PROMO-CAMPUS',
    code: 'CAMPUS100',
    type: 'fixed',
    value: 100,
    active: true,
    maxRedemptions: 50,
    redemptions: 0,
    memberOnly: false,
    minSubtotal: 900,
    description: '₹100 off orders of ₹900+',
  },
];

const uid = (prefix = 'ID') => `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export class CommerceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function isActiveMember(store, email, today = DEMO_TODAY) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  return store.members.find(
    (m) =>
      m.email.toLowerCase() === normalized &&
      m.status !== 'Pending' &&
      m.status !== 'Expired' &&
      m.expires >= today,
  );
}

export function ensureCommerceFields(store) {
  const next = {
    ...store,
    promos: Array.isArray(store.promos) ? store.promos : structuredClone(DEFAULT_PROMOS),
    pointLedger: Array.isArray(store.pointLedger) ? store.pointLedger : [],
    pointRules: resolvePointRules(store),
    waitlist: Array.isArray(store.waitlist) ? store.waitlist : [],
    orders: (Array.isArray(store.orders) ? store.orders : []).map((o) => ({
      ...o,
      status: o.status || 'Placed',
    })),
    products: (store.products || []).map((p) => ({
      ...p,
      image: p.image || PRODUCT_IMAGES[p.type] || PRODUCT_IMAGES.Hoodie,
    })),
    members: (store.members || []).map((m) => ({
      ...m,
      participationPoints: m.participationPoints ?? 0,
      volunteerPoints: m.volunteerPoints ?? 0,
      contributionPoints: m.contributionPoints ?? 0,
    })),
  };
  return next;
}

function findPromo(store, code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  return (store.promos || []).find((p) => p.code === normalized && p.active) || null;
}

export function quotePromo(
  store,
  { code, productId, quantity, joinMembership, email, today = DEMO_TODAY },
) {
  ({ code, productId, quantity, joinMembership } = parseRequest(quoteRequestSchema, {
    code,
    productId,
    quantity: Number(quantity),
    joinMembership,
  }));
  const club = ensureCommerceFields(store);
  const product = club.products.find((p) => p.id === productId);
  if (!product) throw new CommerceError(404, 'Product not found.');
  const qty = Number(quantity);
  const member = isActiveMember(club, email, today);
  const treatedAsMember = !!member || !!joinMembership;
  const unit = treatedAsMember ? product.memberPrice : product.price;
  const subtotal = unit * qty;
  const promo = findPromo(club, code);
  if (!promo) throw new CommerceError(400, 'That promo code is not valid.');
  if (promo.productId && promo.productId !== productId)
    throw new CommerceError(400, 'This coupon is for a different piece in the shop.');
  if (promo.maxRedemptions != null && promo.redemptions >= promo.maxRedemptions)
    throw new CommerceError(400, 'This promo code has reached its redemption limit.');
  if (promo.memberOnly && !treatedAsMember)
    throw new CommerceError(400, 'This promo is for active members. Join membership to use it.');
  if (promo.minSubtotal && subtotal < promo.minSubtotal)
    throw new CommerceError(400, `Spend at least ₹${promo.minSubtotal} before this promo applies.`);
  const discount =
    promo.type === 'percent'
      ? Math.min(subtotal, Math.round((subtotal * promo.value) / 100))
      : Math.min(subtotal, promo.value);
  return {
    discount,
    promoDiscount: discount,
    code: promo.code,
    description: promo.description,
    subtotal,
    unitPrice: unit,
  };
}

export function placeOrder(
  store,
  {
    productId,
    size,
    quantity,
    promoCode,
    joinMembership,
    actor,
    idempotencyKey,
    today = DEMO_TODAY,
  },
) {
  ({ productId, size, quantity, promoCode, joinMembership } = parseRequest(orderRequestSchema, {
    productId,
    size,
    quantity: Number(quantity),
    promoCode,
    joinMembership,
  }));
  if (!actor?.email || !actor?.name)
    throw new CommerceError(400, 'Signed-in buyer details required.');
  const club = ensureCommerceFields(store);
  const product = club.products.find((p) => p.id === productId);
  if (!product) throw new CommerceError(404, 'Product not found.');
  const sizeKey = String(size || '');
  if (!sizeKey || product.stock[sizeKey] == null)
    throw new CommerceError(400, 'Choose a valid size.');
  const qty = Number(quantity);
  if ((product.stock[sizeKey] || 0) < qty)
    throw new CommerceError(409, `Only ${product.stock[sizeKey] || 0} left in ${sizeKey}.`);

  let member = isActiveMember(club, actor.email, today);
  const addingMembership = !member && !!joinMembership;
  const treatedAsMember = !!member || addingMembership;
  const unit = treatedAsMember ? product.memberPrice : product.price;
  let subtotal = unit * qty;
  let promoDiscount = 0;
  let promo = null;
  if (promoCode) {
    const quoted = quotePromo(club, {
      code: promoCode,
      productId,
      quantity: qty,
      joinMembership: addingMembership,
      email: actor.email,
      today,
    });
    promoDiscount = quoted.discount;
    promo = findPromo(club, promoCode);
  }
  const membershipFee = addingMembership ? MEMBERSHIP_FEE : 0;
  const total = Math.max(0, subtotal - promoDiscount) + membershipFee;
  const orderIds = Array.from({ length: qty }, () => uid('ORD'));
  const orders = orderIds.map((id) => ({
    id,
    productId,
    name: actor.name,
    email: actor.email,
    size: sizeKey,
    amount: Math.round((Math.max(0, subtotal - promoDiscount) / qty) * 100) / 100 || 0,
    date: today,
    promoCode: promo?.code,
    status: 'Placed',
    quantity: 1,
  }));

  let members = club.members;
  const transactions = [...club.transactions];
  const notifications = [...(club.notifications || [])];
  const audit = [...(club.audit || [])];
  let pointLedger = [...club.pointLedger];
  let promos = club.promos;

  if (addingMembership) {
    const existing = club.members.find((m) => m.email.toLowerCase() === actor.email.toLowerCase());
    if (existing) {
      members = club.members.map((m) =>
        m.id === existing.id
          ? {
              ...m,
              status: 'Active',
              expires: '2027-07-31',
              role: m.role === 'Pending' ? 'Volunteer' : m.role,
            }
          : m,
      );
      member = members.find((m) => m.id === existing.id);
    } else {
      const created = {
        id: uid('MEM'),
        name: actor.name,
        email: actor.email,
        course: 'Campus community',
        status: 'Active',
        joined: today,
        expires: '2027-07-31',
        role: 'Volunteer',
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      };
      members = [...club.members, created];
      member = created;
    }
    transactions.unshift({
      id: uid('TX'),
      title: `Annual membership · ${actor.name}`,
      category: 'Membership',
      amount: MEMBERSHIP_FEE,
      date: today,
      status: 'Completed',
      createdBy: actor.id || member.id,
    });
    notifications.unshift({
      id: uid('NTF'),
      title: 'Welcome to the club',
      body: 'Your annual membership is active. Member prices now apply on events and merchandise.',
      date: new Date().toISOString(),
      read: false,
      to: actor.email,
    });
  }

  const products = club.products.map((p) =>
    p.id === productId ? { ...p, stock: { ...p.stock, [sizeKey]: p.stock[sizeKey] - qty } } : p,
  );

  if (promo) {
    promos = club.promos.map((p) =>
      p.id === promo.id ? { ...p, redemptions: p.redemptions + 1 } : p,
    );
  }

  transactions.unshift({
    id: uid('TX'),
    title: `${product.name} · ${actor.name}${qty > 1 ? ` ×${qty}` : ''}${promo ? ` · ${promo.code}` : ''}`,
    category: 'Merchandise',
    amount: Math.max(0, subtotal - promoDiscount),
    date: today,
    status: 'Completed',
    createdBy: actor.id || member?.id,
  });

  // Contribution points from club point rules (default: 1 point per ₹100 spent)
  const rules = resolvePointRules(club);
  const rupeesPerPoint = Math.max(1, Number(rules.merchRupeesPerPoint) || 100);
  const contributionEarn =
    rules.merchEnabled === false
      ? 0
      : Math.floor(Math.max(0, subtotal - promoDiscount) / rupeesPerPoint);
  if (member && contributionEarn > 0) {
    const mid = member.id;
    members = members.map((m) =>
      m.id === mid
        ? { ...m, contributionPoints: (m.contributionPoints || 0) + contributionEarn }
        : m,
    );
    pointLedger.unshift({
      id: uid('PTS'),
      memberId: mid,
      kind: 'contribution',
      points: contributionEarn,
      reason: `Merchandise order · ${product.name}`,
      date: today,
      orderId: orderIds[0],
    });
  }

  audit.unshift({
    id: uid('AUD'),
    actor: actor.name,
    action: 'Created',
    entity: 'orders',
    entityId: orderIds[0],
    date: new Date().toISOString(),
    detail: `${product.name} · ${sizeKey} ×${qty}${idempotencyKey ? ` · ${idempotencyKey.slice(0, 8)}` : ''}`,
  });

  const patch = {
    products,
    orders: [...orders, ...club.orders],
    transactions,
    members,
    promos,
    pointLedger,
    notifications,
    audit: [...audit, ...club.audit].slice(0, 500),
  };

  return {
    patch,
    total,
    orders,
    order: orders[0],
    discount: promoDiscount,
    promoDiscount,
    membershipFee,
    memberPriceApplied: treatedAsMember,
  };
}

export function updateOrderStatus(store, { orderId, status, actor }) {
  const club = ensureCommerceFields(store);
  const order = club.orders.find((o) => o.id === orderId);
  if (!order) throw new CommerceError(404, 'Order not found.');
  if (order.status === status) return { patch: {} };
  const orders = club.orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  const auditEntry = {
    id: uid('AUD'),
    actor: actor?.name || 'Staff',
    action: 'Updated',
    entity: 'orders',
    entityId: orderId,
    date: new Date().toISOString(),
    detail: `Order status ${order.status || 'Placed'} → ${status}`,
  };
  return {
    patch: {
      orders,
      audit: [auditEntry, ...(club.audit || [])].slice(0, 500),
    },
  };
}

export function createProduct(store, input) {
  const parsed = parseRequest(createProductSchema, input);
  const club = ensureCommerceFields(store);
  if (!input?.actor?.name) throw new CommerceError(400, 'Staff actor required.');
  const typeLabel = parsed.type === 'Other' ? 'Merchandise' : parsed.type;
  const isUsableImage = (value) =>
    typeof value === 'string' &&
    (/^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value));
  const gallery = [...new Set((parsed.gallery || []).filter(isUsableImage))].slice(0, 3);
  const primary =
    (isUsableImage(parsed.image) && parsed.image) ||
    gallery[0] ||
    PRODUCT_IMAGES[parsed.type] ||
    PRODUCT_IMAGES.Hoodie;
  const product = {
    id: uid('P'),
    name: parsed.name,
    type: typeLabel,
    color: parsed.color,
    price: parsed.price,
    memberPrice: parsed.memberPrice,
    stock: parsed.stock,
    image: primary,
    ...(gallery.length ? { gallery } : {}),
  };
  const units = Object.values(product.stock).reduce((sum, n) => sum + n, 0);
  const auditEntry = {
    id: uid('AUD'),
    actor: input.actor.name,
    action: 'products.create',
    entity: 'products',
    entityId: product.id,
    date: new Date().toISOString(),
    detail: `Listed ${product.name} · ${typeLabel} · ${units} units`,
  };
  return {
    product,
    patch: {
      products: [product, ...(club.products || [])],
      audit: [auditEntry, ...(club.audit || [])].slice(0, 500),
    },
  };
}

export function adjustInventory(store, { productId, size, delta, reason, actor }) {
  ({ productId, size, delta, reason } = parseRequest(inventoryRequestSchema, {
    productId,
    size,
    delta: Number(delta),
    reason,
  }));
  const club = ensureCommerceFields(store);
  if (!actor?.name) throw new CommerceError(400, 'Staff actor required.');
  const product = club.products.find((p) => p.id === productId);
  if (!product) throw new CommerceError(404, 'Product not found.');
  const sizeKey = String(size || '');
  if (!sizeKey || product.stock[sizeKey] == null)
    throw new CommerceError(400, 'Choose a valid size.');
  const change = Number(delta);
  const note = String(reason || '').trim();
  const nextCount = (product.stock[sizeKey] || 0) + change;
  if (nextCount < 0)
    throw new CommerceError(
      409,
      `Cannot reduce ${sizeKey} below zero (currently ${product.stock[sizeKey]}).`,
    );

  const products = club.products.map((p) =>
    p.id === productId ? { ...p, stock: { ...p.stock, [sizeKey]: nextCount } } : p,
  );
  const auditEntry = {
    id: uid('AUD'),
    actor: actor.name,
    action: 'Updated',
    entity: 'products',
    entityId: productId,
    date: new Date().toISOString(),
    detail: `Inventory ${sizeKey}: ${product.stock[sizeKey]} → ${nextCount} · ${note}`,
  };
  return {
    patch: {
      products,
      audit: [auditEntry, ...(club.audit || [])].slice(0, 500),
    },
  };
}

/** Cancel a confirmed ticket and auto-promote the oldest waiting entry. */
export function cancelTicket(store, { ticketId, actor, today = DEMO_TODAY }) {
  const club = ensureCommerceFields(store);
  const ticket = club.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.checkedIn || ticket.status === 'Cancelled')
    throw new CommerceError(409, 'This ticket cannot be cancelled.');
  const first = club.waitlist
    .filter((w) => w.eventId === ticket.eventId && w.status === 'Waiting')
    .sort((a, b) => a.joined.localeCompare(b.joined))[0];

  const waitlist = club.waitlist.map((w) =>
    w.id === first?.id ? { ...w, status: 'Promoted' } : w,
  );
  const tickets = club.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'Cancelled' } : t));
  const events = club.events.map((e) =>
    e.id === ticket.eventId ? { ...e, sold: Math.max(0, e.sold - (first ? 0 : 1)) } : e,
  );
  const notifications = first
    ? [
        {
          id: uid('NTF'),
          title: 'A seat opened up',
          body: `${first.name}, your waitlist offer is reserved. Complete demo checkout to confirm it.`,
          date: new Date().toISOString(),
          read: false,
          to: first.email,
        },
        ...(club.notifications || []),
      ]
    : club.notifications || [];
  const transactions =
    ticket.amount > 0
      ? [
          {
            id: uid('TX'),
            title: `Demo cancellation credit · ${ticket.id}`,
            category: 'Tickets',
            amount: -ticket.amount,
            date: today,
            status: 'Completed',
            eventId: ticket.eventId,
            createdBy: actor?.id || actor?.name,
          },
          ...club.transactions,
        ]
      : club.transactions;

  return {
    patch: { tickets, events, waitlist, notifications, transactions },
    promoted: first || null,
  };
}

export function joinWaitlist(store, { eventId, name, email }) {
  const club = ensureCommerceFields(store);
  const event = club.events.find((e) => e.id === eventId);
  if (!event) throw new CommerceError(404, 'Event not found.');
  if (event.sold < event.capacity)
    throw new CommerceError(
      400,
      'Spots are still available. Book a ticket instead of waitlisting.',
    );
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (
    club.tickets.some(
      (t) =>
        t.eventId === eventId && t.email.toLowerCase() === normalized && t.status !== 'Cancelled',
    )
  )
    throw new CommerceError(409, 'You already have a ticket for this event.');
  if (
    club.waitlist.some(
      (w) => w.eventId === eventId && w.email.toLowerCase() === normalized && w.status !== 'Booked',
    )
  )
    throw new CommerceError(409, 'You are already on the waitlist.');

  const entry = {
    id: uid('WAIT'),
    eventId,
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    joined: new Date().toISOString(),
    status: 'Waiting',
  };
  return { patch: { waitlist: [...club.waitlist, entry] }, entry };
}

/** Award participation points for event check-in and volunteer points for completed tasks. */
export function awardPoints(store, { memberId, kind, points, reason, eventId, taskId, actor }) {
  ({ memberId, kind, points, reason, eventId, taskId } = parseRequest(awardPointsSchema, {
    memberId,
    kind,
    points: Number(points),
    reason,
    eventId,
    taskId,
  }));
  const club = ensureCommerceFields(store);
  const amount = Number(points);
  const member = club.members.find((m) => m.id === memberId);
  if (!member) throw new CommerceError(404, 'Member not found.');
  const field =
    kind === 'participation'
      ? 'participationPoints'
      : kind === 'volunteer'
        ? 'volunteerPoints'
        : 'contributionPoints';
  const members = club.members.map((m) =>
    m.id === memberId ? { ...m, [field]: (m[field] || 0) + amount } : m,
  );
  const entry = {
    id: uid('PTS'),
    memberId,
    kind,
    points: amount,
    reason:
      String(reason || '')
        .trim()
        .slice(0, 160) || `${kind} points`,
    date: DEMO_TODAY,
    eventId,
    taskId,
  };
  const auditEntry = {
    id: uid('AUD'),
    actor: actor?.name || 'System',
    action: 'Created',
    entity: 'pointLedger',
    entityId: entry.id,
    date: new Date().toISOString(),
    detail: `${member.name} · +${amount} ${kind} · ${entry.reason}`,
  };
  return {
    patch: {
      members,
      pointLedger: [entry, ...club.pointLedger],
      audit: [auditEntry, ...(club.audit || [])].slice(0, 500),
    },
    entry,
  };
}

/** When a guest checks in, award participation points once. */
export function checkInWithPoints(store, { ticketId, actor, today = DEMO_TODAY }) {
  const club = ensureCommerceFields(store);
  const ticket = club.tickets.find((t) => t.id === ticketId && t.status !== 'Cancelled');
  if (!ticket) throw new CommerceError(404, 'Ticket not found.');
  if (ticket.checkedIn) throw new CommerceError(409, 'Already checked in.');
  const tickets = club.tickets.map((t) => (t.id === ticketId ? { ...t, checkedIn: true } : t));
  let patch = { tickets };
  const member = isActiveMember(club, ticket.email, today);
  const rules = resolvePointRules(club);
  if (member && rules.checkInEnabled !== false && Number(rules.checkInPoints) > 0) {
    const awarded = awardPoints(
      { ...club, tickets },
      {
        memberId: member.id,
        kind: 'participation',
        points: Math.min(500, Math.max(1, Number(rules.checkInPoints) || 10)),
        reason: `Checked in · ticket ${ticket.id}`,
        eventId: ticket.eventId,
        actor,
      },
    );
    patch = { ...patch, ...awarded.patch, tickets };
  }
  return { patch, ticket: { ...ticket, checkedIn: true } };
}

export function savePointRules(store, { rules, actor }) {
  const club = ensureCommerceFields(store);
  if (!actor?.name) throw new CommerceError(400, 'Staff actor required.');
  const next = {
    checkInEnabled: rules.checkInEnabled !== false,
    checkInPoints: Math.min(500, Math.max(0, Number(rules.checkInPoints) || 0)),
    merchEnabled: rules.merchEnabled !== false,
    merchRupeesPerPoint: Math.min(10000, Math.max(1, Number(rules.merchRupeesPerPoint) || 100)),
    taskEnabled: rules.taskEnabled !== false,
    taskDonePoints: Math.min(500, Math.max(0, Number(rules.taskDonePoints) || 0)),
  };
  const auditEntry = {
    id: uid('AUD'),
    actor: actor.name,
    action: 'points.rules',
    entity: 'pointRules',
    entityId: 'club',
    date: new Date().toISOString(),
    detail: `Check-in ${next.checkInEnabled ? next.checkInPoints + ' pts' : 'off'}; merch 1/${next.merchRupeesPerPoint}; tasks ${next.taskEnabled ? next.taskDonePoints + ' pts' : 'off'}`,
  };
  return {
    patch: {
      pointRules: next,
      audit: [auditEntry, ...(club.audit || [])].slice(0, 500),
    },
  };
}
