import { createHash } from 'node:crypto';
import { parseDatabaseRecord } from '../../backend/src/database/schemas/index.js';
import { clubKey } from '../../backend/src/shared/records.js';
import { accountKey } from '../../backend/src/modules/auth/password.js';

export const demoCollections = [
  'members',
  'events',
  'products',
  'tickets',
  'orders',
  'transactions',
  'tasks',
  'promos',
  'pointLedger',
  'announcements',
  'notifications',
  'deliveries',
  'waitlist',
  'eventReviews',
  'audit',
];
const firstNames = [
  'Aarav',
  'Aditi',
  'Arjun',
  'Ananya',
  'Dev',
  'Diya',
  'Ishaan',
  'Kavya',
  'Kabir',
  'Meera',
  'Neel',
  'Nisha',
  'Rohan',
  'Riya',
  'Sahil',
  'Sana',
  'Ved',
  'Tara',
  'Vihaan',
  'Zoya',
];
const lastNames = [
  'Sharma',
  'Patel',
  'Singh',
  'Gupta',
  'Rao',
  'Verma',
  'Mehta',
  'Shah',
  'Nair',
  'Das',
];
const dateAt = (today, days) =>
  new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const identifier = (type, i) => `DEMO-${type}-${String(i + 1).padStart(3, '0')}`;
export function buildDemoData({ organizations, count = 200, today = '2026-10-11', passwordHash }) {
  const clubs = Object.fromEntries(
    organizations.map((o) => [o.id, Object.fromEntries(demoCollections.map((c) => [c, []]))]),
  );
  const records = [];
  for (let i = 0; i < count; i++) {
    const club = organizations[i % organizations.length],
      data = clubs[club.id];
    const userId = identifier('USER', i),
      eventId = identifier('EVT', i),
      productId = identifier('PRD', i),
      ticketId = identifier('TKT', i),
      orderId = identifier('ORD', i),
      taskId = identifier('TASK', i),
      announcementId = identifier('ANN', i);
    const name = `Demo ${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
    const email = `demo${String(i + 1).padStart(3, '0')}@example.test`;
    const created = dateAt(today, -45 + (i % 46)),
      eventDate = dateAt(today, -20 + (i % 65)),
      stamp = created + 'T04:30:00.000Z';
    const status = ['Active', 'Pending', 'Expiring', 'Expired'][i % 4];
    const expires = dateAt(today, status === 'Expired' ? -7 : status === 'Expiring' ? 7 : 180);
    const memberPrice = 100 + (i % 5) * 25,
      amount = memberPrice * 100;
    const kind = ['participation', 'volunteer', 'contribution'][i % 3],
      points = 10 + (i % 15);
    const member = {
      id: userId,
      userId,
      name,
      email,
      course: ['Computer Science', 'Commerce', 'Design', 'Engineering'][i % 4],
      status,
      joined: created,
      expires,
      role: i % 3 === 0 ? 'Volunteer' : 'Member',
      whatsappOptIn: false,
      preferences: { email: false, renewals: false, weekly: false, events: false },
      participationPoints: kind === 'participation' ? points : 0,
      volunteerPoints: kind === 'volunteer' ? points : 0,
      contributionPoints: kind === 'contribution' ? points : 0,
      duesWaived: status === 'Active' || status === 'Expiring',
      enrollmentSource: 'Demo seed',
    };
    data.members.push(member);
    data.events.push({
      id: eventId,
      title: `Demo ${['Workshop', 'Campus Meetup', 'Volunteer Drive', 'Sports Day'][i % 4]} ${i + 1}`,
      date: eventDate,
      time: ['10:00', '14:00', '16:30', '18:00'][i % 4],
      endTime: ['12:00', '16:00', '18:30', '20:00'][i % 4],
      capacity: 80,
      sold: 1,
      price: memberPrice + 50,
      memberPrice,
      venue: ['Main Hall', 'Lab A', 'Sports Ground'][i % 3],
      category: ['Workshop', 'Social', 'Cultural', 'Sports'][i % 4],
    });
    data.products.push({
      id: productId,
      name: `Demo ${['Club Tee', 'Notebook', 'Campus Mug', 'Tote Bag'][i % 4]} ${i + 1}`,
      type: i % 4 === 0 ? 'Apparel' : 'Accessories',
      price: memberPrice + 50,
      memberPrice,
      stock: { S: 15, M: 20, L: 15 },
    });
    const activeMember = ['Active', 'Expiring'].includes(status),
      purchasePrice = activeMember ? memberPrice : memberPrice + 50;
    data.tickets.push({
      id: ticketId,
      eventId,
      userId,
      name,
      email,
      member: activeMember,
      checkedIn: eventDate < today,
      amount: purchasePrice,
      status: 'Confirmed',
      simulated: true,
    });
    data.orders.push({
      id: orderId,
      productId,
      userId,
      name,
      email,
      size: 'M',
      amount: purchasePrice,
      date: created,
      status: ['Placed', 'Ready for pickup', 'Picked up'][i % 3],
      simulated: true,
    });
    data.transactions.push({
      id: identifier('TX', i),
      title: `Demo ${i % 3 === 0 ? 'expense' : i % 3 === 1 ? 'ticket sale' : 'merchandise sale'} ${i + 1}`,
      category: i % 3 === 0 ? 'Supplies' : i % 3 === 1 ? 'Event tickets' : 'Merchandise',
      amount: i % 3 === 0 ? -memberPrice : purchasePrice,
      date: created,
      status: i % 15 === 0 ? 'Rejected' : 'Completed',
      createdBy: userId,
      simulated: true,
      ...(i % 3 === 1 ? { eventId, ticketId } : i % 3 === 2 ? { orderId } : {}),
    });
    data.tasks.push({
      id: taskId,
      title: `Demo ${['Set up venue', 'Register guests', 'Plan activity', 'Prepare poster'][i % 4]} ${i + 1}`,
      description: 'Sample task for the demo dataset.',
      assignee: name,
      assigneeId: userId,
      due: eventDate,
      priority: ['Low', 'Medium', 'High'][i % 3],
      status: ['To do', 'In progress', 'Done'][i % 3],
    });
    data.promos.push({
      id: identifier('PROMO', i),
      code: `DEMO${String(i + 1).padStart(3, '0')}`,
      type: 'percent',
      value: 10,
      active: false,
      redemptions: 0,
      memberOnly: true,
    });
    data.pointLedger.push({
      id: identifier('POINT', i),
      memberId: userId,
      kind,
      points,
      reason: 'Demo activity award',
      date: stamp,
      ...(kind === 'participation' ? { eventId } : kind === 'volunteer' ? { taskId } : { orderId }),
    });
    data.announcements.push({
      id: announcementId,
      title: `Demo club update ${i + 1}`,
      body: 'Sample update for exploring the workspace.',
      audience: 'All members',
      date: created,
      author: name,
      read: i % 25,
      email: false,
      whatsapp: false,
    });
    data.notifications.push({
      id: identifier('NOT', i),
      title: `Demo notification ${i + 1}`,
      body: 'Sample workspace notification.',
      date: stamp,
      read: true,
      userId,
      to: '/app/communications',
    });
    data.deliveries.push({
      id: identifier('DEL', i),
      announcementId,
      channel: 'In-app',
      recipient: email,
      status: 'Sent',
      date: stamp,
      detail: 'Demo in-app record. No external message sent.',
      userId,
    });
    data.waitlist.push({
      id: identifier('WAIT', i),
      eventId,
      userId,
      name,
      email,
      joined: stamp,
      status: 'Waiting',
    });
    data.eventReviews.push({
      id: identifier('REVIEW', i),
      eventId,
      authorId: userId,
      authorName: name,
      rating: 1 + (i % 5),
      comment: 'Demo feedback for the sample event.',
      date: stamp,
    });
    const audit = {
      id: identifier('AUD', i),
      actor: userId,
      action: 'demo.seed',
      clubId: club.id,
      date: stamp,
      detail: 'Demo dataset entry.',
    };
    data.audit.push(audit);
    records.push(
      {
        pk: 'USER#' + userId,
        sk: 'PROFILE',
        id: userId,
        name,
        email,
        emailVerified: false,
        sessionVersion: 1,
        createdAt: stamp,
      },
      { pk: 'USER#' + userId, sk: 'ACCESS#' + club.id, clubId: club.id, role: 'member' },
    );
    if (passwordHash)
      records.push({ pk: accountKey(email), sk: 'ACCOUNT', id: userId, passwordHash });
    records.push({ pk: clubKey(club.id), sk: `AUDIT#${stamp}#${audit.id}`, ...audit });
    const paymentId = identifier('PAY', i),
      paymentKey = 'USER#' + userId,
      paymentSk = 'PAYMENT#' + paymentId;
    records.push({
      pk: paymentKey,
      sk: paymentSk,
      id: paymentId,
      userId,
      clubId: club.id,
      fingerprint: createHash('sha256').update(paymentId).digest('hex'),
      action: { type: 'tickets.book', args: { eventId } },
      amount,
      currency: 'INR',
      mode: 'test',
      status: 'CreationFailed',
      version: 0,
      createdAt: stamp,
    });
    records.push({
      pk: clubKey(club.id),
      sk: 'REFUND#' + paymentId,
      id: identifier('RF', i),
      clubId: club.id,
      userId,
      requesterName: name,
      paymentId,
      paymentPk: paymentKey,
      paymentSk,
      amount,
      currency: 'INR',
      mode: 'test',
      status: 'Rejected',
      reason: 'Demo refund example; no provider payment exists.',
      detail: 'Synthetic demo record. No Razorpay charge or refund was made.',
      createdAt: stamp,
      updatedAt: stamp,
      version: 0,
      reviewedBy: 'SYSTEM',
      rejectionReason: 'Demo dataset: no real payment to refund.',
    });
    const receiptId = 'RECEIPT-' + identifier('CHECK', i),
      sourceKey = `skyline-campus/${club.id}/${userId}/${receiptId}`,
      receiptKey = `skyline-campus/${club.id}/${userId}/checked/${receiptId}`;
    records.push({
      pk: clubKey(club.id),
      sk: 'RECEIPT#' + receiptId,
      id: receiptId,
      clubId: club.id,
      userId,
      sourceKey,
      receiptKey,
      claimedAmount: amount,
      status: 'NeedsReview',
      version: 0,
      createdAt: stamp,
      issues: ['Synthetic demo receipt. OCR has not verified this sample.'],
      extracted: {
        vendor: 'Demo Campus Supplies',
        total: amount,
        currency: 'INR',
        invoiceNumber: identifier('INVOICE', i),
        dateText: created,
      },
    });
  }
  for (const data of Object.values(clubs)) {
    const fullEvents = data.events.filter((e) => e.date > today).slice(0, 2);
    for (const event of fullEvents) event.capacity = event.sold;
    for (const entry of data.waitlist) {
      const ownEvent = data.tickets.find((t) => t.userId === entry.userId).eventId;
      entry.eventId = fullEvents.find((e) => e.id !== ownEvent).id;
    }
    const pastEvents = data.events.filter((e) => e.date < today);
    for (let i = 0; i < data.eventReviews.length; i++)
      data.eventReviews[i].eventId = pastEvents[i % pastEvents.length].id;
  }
  for (const record of records) parseDatabaseRecord(record);
  return { organizations, clubs, records };
}
export function mergeDemoData(current, demo) {
  const data = structuredClone(current);
  for (const collection of demoCollections) {
    const rows = data[collection] || [];
    const existing = new Set(rows.map((r) => r.id));
    data[collection] = [...rows, ...demo[collection].filter((r) => !existing.has(r.id))];
  }
  return data;
}
