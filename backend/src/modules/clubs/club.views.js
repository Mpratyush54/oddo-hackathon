import { finance } from '../../shared/authorization.js';
import { ownMember } from '../../shared/validation.js';
import { matchesAudience } from '../communications/audience.js';

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
