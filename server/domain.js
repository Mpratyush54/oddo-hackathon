import { createHash } from 'node:crypto';
import { HttpError, clubKey, dateToday, timestamp, recordId } from './repository.js';
import {
  adjustInventory,
  awardPoints,
  cancelTicket,
  checkInWithPoints,
  ensureCommerceFields,
  joinWaitlist,
  placeOrder,
  quotePromo,
  isActiveMember,
} from './commerce.js';
import { accountKey } from './auth.js';

const staff = ['admin', 'organizer'];
const finance = ['admin', 'treasurer'];
export const allowedRoles = ['member', 'organizer', 'treasurer', 'admin', 'college'];
export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new HttpError(403, 'Your role cannot perform this action.');
}
function text(value, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new HttpError(400, 'Required text is missing or too long.');
  return value.trim();
}
function amount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000)
    throw new HttpError(400, 'Enter a valid amount.');
  return Math.round(value * 100) / 100;
}
function eventFor(data, id) {
  const event = data.events.find((e) => e.id === id);
  if (!event) throw new HttpError(404, 'Event not found.');
  return event;
}
function openEvent(event) {
  if (
    new Date(`${event.endDate || event.date}T${event.endTime || '23:59'}:00+05:30`).getTime() <
    Date.now()
  )
    throw new HttpError(409, 'This event has ended.');
}
const ownMember = (data, user) => data.members.find((m) => m.userId === user.id);

export function visibleState(data, user, role) {
  const copy = structuredClone(data),
    elevated = ['admin', 'organizer', 'treasurer'].includes(role);
  if (!elevated) {
    const member = ownMember(data, user);
    copy.announcements = copy.announcements.filter(
      (a) => member && matchesAudience(member, a.audience),
    );
    copy.events = copy.events.map(({ budget, ...event }) => event);
    copy.members = copy.members.filter((m) => m.userId === user.id);
    copy.tickets = copy.tickets.filter((t) => t.userId === user.id);
    copy.orders = copy.orders.filter((o) => o.userId === user.id);
    copy.waitlist = copy.waitlist.filter((w) => w.email === user.email);
    copy.tasks = copy.tasks.filter((t) => t.assigneeId === user.id || t.assignee === user.name);
    copy.pointLedger = copy.pointLedger.filter((p) =>
      copy.members.some((m) => m.id === p.memberId),
    );
    copy.deliveries = [];
  }
  if (!finance.includes(role))
    copy.transactions = copy.transactions.filter((t) => t.createdBy === user.id);
  if (!['admin', 'treasurer'].includes(role)) copy.audit = [];
  copy.notifications = copy.notifications
    .filter(
      (n) =>
        (!n.userId || n.userId === user.id) &&
        (!String(n.to || '').includes('@') || n.to === user.email) &&
        (elevated ||
          !n.audience ||
          (ownMember(data, user) && matchesAudience(ownMember(data, user), n.audience))),
    )
    .map((n) => ({
      ...n,
      read: (ownMember(data, user)?.readNotificationIds || []).includes(n.id),
    }));
  copy.preferences = ownMember(data, user)?.preferences || {
    email: true,
    renewals: true,
    weekly: false,
  };
  copy.profile = { name: user.name, email: user.email, role };
  return copy;
}
export function publicState(data) {
  return {
    ...data,
    members: [],
    tickets: [],
    orders: [],
    transactions: [],
    tasks: [],
    announcements: [],
    audit: [],
    waitlist: [],
    notifications: [],
    deliveries: [],
    pointLedger: [],
    profile: { name: '', email: '', role: '' },
    preferences: { email: false, renewals: false, weekly: false },
    events: data.events.map(({ budget, ...e }) => e),
  };
}

export function applyAction(input, action, user, role, now = dateToday(), context = {}) {
  let data = ensureCommerceFields(structuredClone(input));
  const actor = { id: user.id, name: user.name, email: user.email };
  const args = action.args || {};
  let result = {};
  switch (action.type) {
    case 'members.add': {
      requireRole(role, ['admin']);
      const target = context.targetUser;
      if (!target)
        throw new HttpError(
          404,
          'This student must create an account before being added to the club.',
        );
      if (data.members.some((m) => m.userId === target.id))
        throw new HttpError(409, 'This student is already a member.');
      const active = args.member?.status === 'Active';
      data.members.push({
        id: target.id,
        userId: target.id,
        name: target.name,
        email: target.email,
        course: String(args.member?.course || 'Campus community').slice(0, 100),
        role: args.member?.role === 'Volunteer' ? 'Volunteer' : 'Member',
        status: active ? 'Active' : 'Pending',
        joined: now,
        expires: active ? `${Number(now.slice(0, 4)) + 1}-07-31` : now,
        whatsappOptIn: false,
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      });
      if (active)
        data.transactions.unshift({
          id: recordId('TX'),
          title: `Membership dues · ${target.name} (simulated payment)`,
          category: 'Membership',
          amount: 500,
          date: now,
          status: 'Completed',
          createdBy: user.id,
          simulated: true,
        });
      break;
    }
    case 'membership.join': {
      if (ownMember(data, user)) throw new HttpError(409, 'You already joined this club.');
      data.members.push({
        id: user.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        course: String(args.course || 'Campus community').slice(0, 100),
        status: 'Pending',
        joined: now,
        expires: now,
        role: 'Member',
        whatsappOptIn: false,
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      });
      break;
    }
    case 'membership.demo-dues': {
      const member = args.memberId
        ? data.members.find((m) => m.id === args.memberId)
        : ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      if (member.userId !== user.id) requireRole(role, ['admin']);
      if (member.status === 'Active' && member.expires >= now)
        throw new HttpError(409, 'This membership is already active.');
      member.status = 'Active';
      member.expires = `${Number(now.slice(0, 4)) + 1}-07-31`;
      data.transactions.unshift({
        id: recordId('TX'),
        title: `Membership dues · ${user.name} (simulated payment)`,
        category: 'Membership',
        amount: 500,
        date: now,
        status: 'Completed',
        createdBy: user.id,
        simulated: true,
      });
      break;
    }
    case 'profile.preferences': {
      const member = ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      const phone = Object.hasOwn(args, 'phone')
        ? String(args.phone || '').trim()
        : member.phone || '';
      if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
        throw new HttpError(400, 'Use a phone number with country code.');
      if (args.whatsappOptIn && !phone)
        throw new HttpError(400, 'Add your WhatsApp number before opting in.');
      member.phone = phone;
      if (Object.hasOwn(args, 'whatsappOptIn')) {
        member.whatsappOptIn = args.whatsappOptIn === true;
        member.consentUpdatedAt = timestamp();
      }
      if (args.preferences)
        member.preferences = {
          email: args.preferences.email === true,
          renewals: args.preferences.renewals === true,
          weekly: args.preferences.weekly === true,
        };
      break;
    }
    case 'tickets.book': {
      const event = eventFor(data, args.eventId);
      openEvent(event);
      const offered = data.waitlist.some(
        (w) => w.eventId === event.id && w.email === user.email && w.status === 'Promoted',
      );
      if (event.sold >= event.capacity && !offered)
        throw new HttpError(409, 'This event is full. Join the waitlist.');
      if (
        data.tickets.some(
          (t) => t.eventId === event.id && t.userId === user.id && t.status !== 'Cancelled',
        )
      )
        throw new HttpError(409, 'You already booked this event.');
      const member = !!isActiveMember(data, user.email, now),
        price = member ? event.memberPrice : event.price;
      const ticket = {
        id: recordId('TKT'),
        eventId: event.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        member,
        checkedIn: false,
        amount: price,
        status: 'Confirmed',
        simulated: true,
      };
      data.tickets.unshift(ticket);
      if (!offered) event.sold++;
      data.transactions.unshift({
        id: recordId('TX'),
        title: `${event.title} · ${user.name} (simulated payment)`,
        category: 'Tickets',
        amount: price,
        date: now,
        status: 'Completed',
        eventId: event.id,
        createdBy: user.id,
        simulated: true,
      });
      data.waitlist = data.waitlist.map((w) =>
        w.eventId === event.id && w.email === user.email ? { ...w, status: 'Booked' } : w,
      );
      result = { ticket };
      break;
    }
    case 'tickets.cancel': {
      const ticket = data.tickets.find((t) => t.id === args.ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found.');
      if (!staff.includes(role) && ticket.userId !== user.id)
        throw new HttpError(403, 'This ticket belongs to another user.');
      if (ticket.status === 'Cancelled' || ticket.checkedIn)
        throw new HttpError(409, 'This ticket cannot be cancelled.');
      openEvent(eventFor(data, ticket.eventId));
      result = cancelTicket(data, { ticketId: ticket.id, actor, today: now });
      data = { ...data, ...result.patch };
      break;
    }
    case 'check-in': {
      requireRole(role, staff);
      result = checkInWithPoints(data, { ticketId: args.ticketId, actor, today: now });
      data = { ...data, ...result.patch };
      break;
    }
    case 'waitlist.join': {
      openEvent(eventFor(data, args.eventId));
      result = joinWaitlist(data, { eventId: args.eventId, name: user.name, email: user.email });
      data = { ...data, ...result.patch };
      break;
    }
    case 'orders': {
      result = placeOrder(data, {
        productId: args.productId,
        size: args.size,
        quantity: args.quantity,
        promoCode: args.promoCode,
        joinMembership: args.joinMembership === true,
        actor,
        today: now,
      });
      result.patch.orders = result.patch.orders.map((o) =>
        result.orders.some((x) => x.id === o.id) ? { ...o, userId: user.id, simulated: true } : o,
      );
      result.patch.members = result.patch.members.map((m) =>
        m.email === user.email
          ? { ...m, id: ownMember(data, user)?.id || m.id, userId: user.id }
          : m,
      );
      data = { ...data, ...result.patch };
      break;
    }
    case 'inventory':
      requireRole(role, ['admin']);
      result = adjustInventory(data, { ...args, actor });
      data = { ...data, ...result.patch };
      break;
    case 'points.award':
      requireRole(role, staff);
      result = awardPoints(data, { ...args, actor });
      data = { ...data, ...result.patch };
      break;
    case 'expenses.create': {
      const value = amount(args.amount),
        receiptKey = text(args.receiptKey, 250);
      if (!receiptKey.startsWith(`skyline-campus/${action.clubId}/${user.id}/`))
        throw new HttpError(403, 'Receipt does not belong to this account and club.');
      if (args.eventId) eventFor(data, args.eventId);
      data.transactions.unshift({
        id: recordId('TX'),
        title: text(args.title, 160),
        category: 'Expenses',
        amount: -value,
        date: now,
        status: 'Pending',
        receipt: text(args.receipt, 120),
        receiptKey,
        eventId: args.eventId,
        createdBy: user.id,
      });
      break;
    }
    case 'expenses.review': {
      requireRole(role, finance);
      const tx = data.transactions.find((t) => t.id === args.transactionId);
      if (!tx) throw new HttpError(404, 'Expense not found.');
      if (tx.status !== 'Pending' || tx.amount >= 0)
        throw new HttpError(409, 'Only pending expenses can be reviewed.');
      if (tx.createdBy === user.id)
        throw new HttpError(403, 'Another treasurer must review your expense.');
      if (!['Completed', 'Rejected'].includes(args.status))
        throw new HttpError(400, 'Choose approve or reject.');
      tx.status = args.status;
      tx.reviewedBy = user.id;
      tx.reviewedAt = timestamp();
      if (args.status === 'Rejected') tx.rejectionReason = text(args.reason, 500);
      break;
    }
    case 'income.create': {
      requireRole(role, finance);
      data.transactions.unshift({
        id: recordId('TX'),
        title: text(args.title, 160),
        category: text(args.category, 40),
        amount: amount(args.amount),
        date: now,
        status: 'Completed',
        createdBy: user.id,
      });
      break;
    }
    case 'announcements.publish': {
      requireRole(role, staff);
      const audience = text(args.audience, 80);
      if (
        !['All members', 'Active members', 'Volunteers', 'Pending dues', 'Renewing soon'].includes(
          audience,
        )
      )
        throw new HttpError(400, 'Unknown audience.');
      const announcement = {
        id: recordId('ANN'),
        title: text(args.title, 100),
        body: text(args.body, 3000),
        audience,
        date: now,
        author: user.name,
        authorId: user.id,
        read: 0,
        email: args.email === true,
        whatsapp: args.whatsapp === true,
        recipients: data.members.filter((m) => matchesAudience(m, audience)).length,
      };
      data.announcements.unshift(announcement);
      data.notifications.unshift({
        id: recordId('NOT'),
        title: announcement.title,
        body: announcement.body,
        date: now,
        read: false,
        to: '/app/announcements',
        audience,
      });
      for (const member of data.members.filter((m) => m.userId && matchesAudience(m, audience)))
        for (const channel of [
          ...(announcement.email ? ['Email'] : []),
          ...(announcement.whatsapp && member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
        ])
          data.deliveries.unshift({
            id: recordId('DEL'),
            announcementId: announcement.id,
            channel,
            recipient: channel === 'WhatsApp' ? member.phone : member.email,
            status: 'Prepared',
            date: now,
            detail: 'Prepared only. No external message sent.',
          });
      result = { announcement };
      break;
    }
    case 'reminders.prepare': {
      requireRole(role, staff);
      if (!['Pending', 'Expiring'].includes(args.status))
        throw new HttpError(400, 'Unknown reminder audience.');
      const announcementId = `REM-${args.status}-${now}`;
      if (data.deliveries.some((d) => d.announcementId === announcementId))
        throw new HttpError(409, 'Reminders have already been prepared today.');
      for (const member of data.members.filter((m) => m.userId && m.status === args.status))
        for (const channel of [
          'Email',
          ...(member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
        ])
          data.deliveries.unshift({
            id: recordId('DEL'),
            announcementId,
            channel,
            recipient: channel === 'WhatsApp' ? member.phone : member.email,
            status: 'Prepared',
            date: now,
            detail: 'Reminder prepared. No external message sent.',
          });
      break;
    }
    case 'notifications.read': {
      const member = ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      if (!Array.isArray(args.ids) || args.ids.length > 100)
        throw new HttpError(400, 'Choose up to 100 notifications.');
      const allowed = data.notifications
        .filter((n) => !n.userId || n.userId === user.id)
        .map((n) => n.id);
      member.readNotificationIds = [
        ...new Set([
          ...(member.readNotificationIds || []),
          ...args.ids.filter((id) => allowed.includes(id)),
        ]),
      ].slice(-100);
      break;
    }
    case 'promos.save': {
      requireRole(role, ['admin']);
      const promo = args.promo;
      if (
        !promo ||
        !/^[A-Z0-9]{4,16}$/.test(promo.code) ||
        !['percent', 'fixed'].includes(promo.type) ||
        !Number.isFinite(promo.value) ||
        promo.value <= 0 ||
        (promo.type === 'percent' && promo.value > 100) ||
        promo.value > 1000000
      )
        throw new HttpError(400, 'Enter a valid promo code and discount.');
      const prior = data.promos.find((p) => p.id === promo.id);
      if (data.promos.some((p) => p.code === promo.code && p.id !== prior?.id))
        throw new HttpError(409, 'This promo code already exists.');
      if (
        promo.maxRedemptions !== undefined &&
        (!Number.isInteger(promo.maxRedemptions) ||
          promo.maxRedemptions < 1 ||
          promo.maxRedemptions > 100000)
      )
        throw new HttpError(400, 'Choose a valid redemption limit.');
      const next = {
        id: prior?.id || recordId('PROMO'),
        code: promo.code,
        type: promo.type,
        value: promo.value,
        active: promo.active === true,
        maxRedemptions: promo.maxRedemptions,
        redemptions: prior?.redemptions || 0,
        memberOnly: promo.memberOnly === true,
        minSubtotal:
          Number.isFinite(promo.minSubtotal) && promo.minSubtotal >= 0 ? promo.minSubtotal : 0,
        description: String(promo.description || '').slice(0, 300),
      };
      data.promos = [next, ...data.promos.filter((p) => p.id !== next.id)];
      break;
    }
    case 'events.save': {
      requireRole(role, staff);
      const e = args.event;
      if (
        !e ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
        !/^\d{2}:\d{2}$/.test(e.time) ||
        !Number.isInteger(e.capacity) ||
        e.capacity < 1 ||
        e.capacity > 10000 ||
        !Number.isFinite(e.price) ||
        e.price < 0 ||
        !Number.isFinite(e.memberPrice) ||
        e.memberPrice < 0
      )
        throw new HttpError(400, 'Enter a valid event schedule, capacity, and prices.');
      const prior = e.id ? data.events.find((x) => x.id === e.id) : null;
      if (e.capacity < (prior?.sold || 0))
        throw new HttpError(409, 'Capacity cannot be lower than bookings.');
      const event = {
        id: prior?.id || recordId('EVT'),
        title: text(e.title, 100),
        description: text(e.description, 5000),
        date: e.date,
        time: e.time,
        venue: text(e.venue, 120),
        category: text(e.category, 40),
        price: e.price,
        memberPrice: e.memberPrice,
        capacity: e.capacity,
        sold: prior?.sold || 0,
        image: /^https:\/\//.test(String(e.image)) ? e.image : '',
        budget: Number.isFinite(e.budget) && e.budget >= 0 ? e.budget : prior?.budget || 0,
        recap: String(e.recap || '').slice(0, 2500),
        gallery: Array.isArray(e.gallery)
          ? e.gallery
              .filter((url) => typeof url === 'string' && url.startsWith('https://'))
              .slice(0, 3)
          : [],
        endTime: /^\d{2}:\d{2}$/.test(e.endTime || '') ? e.endTime : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(e.endDate || '') ? e.endDate : undefined,
      };
      data.events = [event, ...data.events.filter((x) => x.id !== event.id)];
      break;
    }
    case 'tasks.save': {
      const task = args.task,
        prior = data.tasks.find((t) => t.id === task?.id);
      if (!staff.includes(role)) {
        if (!prior || (prior.assigneeId !== user.id && prior.assignee !== user.name))
          throw new HttpError(403, 'You can update only your assigned task.');
        if (!['To do', 'In progress', 'Done'].includes(task.status))
          throw new HttpError(400, 'Unknown task status.');
        prior.status = task.status;
      } else {
        if (
          !['To do', 'In progress', 'Done'].includes(task?.status) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(task.due)
        )
          throw new HttpError(400, 'Enter a valid task status and due date.');
        const assignee = data.members.find((m) => m.name === task.assignee);
        const next = {
          id: prior?.id || recordId('TASK'),
          title: text(task.title, 160),
          description: String(task.description || '').slice(0, 2000),
          assignee: assignee?.name || '',
          assigneeId: assignee?.userId,
          due: task.due,
          priority: String(task.priority || 'Medium').slice(0, 20),
          status: task.status,
        };
        data.tasks = [next, ...data.tasks.filter((t) => t.id !== next.id)];
      }
      break;
    }
    case 'reviews.create': {
      const event = eventFor(data, args.eventId);
      if (
        event.date >= now ||
        !data.tickets.some((t) => t.eventId === event.id && t.userId === user.id && t.checkedIn)
      )
        throw new HttpError(403, 'Only checked-in attendees can review an ended event.');
      if (
        !Number.isInteger(args.rating) ||
        args.rating < 1 ||
        args.rating > 5 ||
        (data.eventReviews || []).some((r) => r.eventId === event.id && r.authorId === user.id)
      )
        throw new HttpError(409, 'A valid single review is required.');
      data.eventReviews = [
        {
          id: recordId('REV'),
          eventId: event.id,
          authorId: user.id,
          authorName: user.name,
          rating: args.rating,
          comment: text(args.comment, 1500),
          date: timestamp(),
        },
        ...(data.eventReviews || []),
      ];
      break;
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
  return { data, result };
}
export function matchesAudience(member, audience) {
  return (
    audience === 'All members' ||
    (audience === 'Active members' && member.status === 'Active') ||
    (audience === 'Volunteers' && member.role === 'Volunteer') ||
    (audience === 'Pending dues' && member.status === 'Pending') ||
    (audience === 'Renewing soon' && member.status === 'Expiring')
  );
}

export function createDomain({ repo, clubs }) {
  async function load(clubId) {
    if (!clubs.some((c) => c.id === clubId)) throw new HttpError(404, 'Club not found.');
    const item = await repo.get(clubKey(clubId), 'STATE');
    if (!item) throw new HttpError(503, 'Club data has not been initialized.');
    return item;
  }
  async function roleFor(user, clubId) {
    return (await repo.get(`USER#${user.id}`, `ACCESS#${clubId}`))?.role || 'member';
  }
  async function execute(clubId, action, user) {
    const pk = clubKey(clubId),
      role = await roleFor(user, clubId);
    if (typeof action.idempotencyKey !== 'string' || !/^[\w-]{8,100}$/.test(action.idempotencyKey))
      throw new HttpError(400, 'A unique idempotencyKey is required.');
    const sk = `REQUEST#${user.id}#${action.idempotencyKey}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ type: action.type, args: action.args || {} }))
      .digest('hex');
    const context = {};
    if (action.type === 'members.add') {
      requireRole(role, ['admin']);
      const account = await repo.get(accountKey(action.args?.member?.email || ''), 'ACCOUNT');
      if (account) context.targetUser = await repo.get(`USER#${account.id}`, 'PROFILE');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const cached = await repo.get(pk, sk);
      if (cached) {
        if (cached.fingerprint !== fingerprint)
          throw new HttpError(409, 'This request key was used for another action.');
        return { ...cached.result, state: visibleState((await load(clubId)).data, user, role) };
      }
      const current = await load(clubId);
      const { data, result } = applyAction(
        current.data,
        { ...action, clubId },
        user,
        role,
        dateToday(),
        context,
      );
      const audit = {
        id: recordId('AUD'),
        actor: user.id,
        clubId,
        collegeId: 'skyline-campus',
        action: action.type,
        entity: action.type.split('.')[0],
        entityId:
          result.ticket?.id ||
          result.announcement?.id ||
          action.args?.transactionId ||
          action.args?.ticketId ||
          clubId,
        date: timestamp(),
        detail: `${user.name} · ${action.type}`,
      };
      data.audit = [audit, ...(data.audit || [])].slice(0, 100);
      const { patch, ...safeResult } = result;
      if (
        await repo.commit(pk, current.version, data, audit, { sk, fingerprint, result: safeResult })
      )
        return { ...safeResult, state: visibleState(data, user, role) };
    }
    throw new HttpError(
      409,
      'Another update is in progress. Reload and retry using the same request key.',
    );
  }
  return {
    load,
    roleFor,
    execute,
    quote: (data, args, user) =>
      quotePromo(data, { ...args, email: user.email, today: dateToday() }),
  };
}
