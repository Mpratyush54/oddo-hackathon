import { createHash } from 'node:crypto';
import { daysUntil, renewingSoon } from '../../../../shared/reminders.js';
export { daysUntil, renewingSoon };
export function membershipReminder(member, today, manualStatus) {
  if (!member.userId || member.refundPending || member.preferences?.renewals === false) return null;
  const days = daysUntil(member.expires, today);
  const pending = member.status === 'Pending';
  if (manualStatus && !(manualStatus === 'Pending' ? pending : renewingSoon(member, today)))
    return null;
  if (!manualStatus && !pending && ![30, 7, 1, 0].includes(days)) return null;
  return {
    key: pending
      ? `membership:${member.id}:pending-week-${Math.max(0, Math.floor(daysUntil(today, member.joined) / 7))}`
      : `membership:${member.id}:${member.expires}:${today}`,
    userId: member.userId,
    title: pending ? 'Membership dues reminder' : 'Membership renewal reminder',
    body: pending
      ? `Hi ${member.name}, activate your club membership to receive your member card and member prices.`
      : `Hi ${member.name}, your club membership ${days === 0 ? 'expires today' : 'expires on ' + member.expires}. Renew to keep your benefits.`,
    url: '/app/my-card',
    kind: 'membership',
    membershipExpires: member.expires,
  };
}
export function eventReminders(data, now) {
  const reminders = [];
  for (const ticket of data.tickets.filter(
    (t) => !t.checkedIn && !t.refundPending && t.status !== 'Cancelled' && t.userId,
  )) {
    const member = data.members.find((m) => m.userId === ticket.userId);
    const event = data.events.find((e) => e.id === ticket.eventId);
    if (!member || member.preferences?.events === false || !event) continue;
    const start = Date.parse(`${event.date}T${event.time}:00+05:30`);
    const hours = (start - now.getTime()) / 3600000;
    if (hours <= 0 || hours > 24) continue;
    const lead = hours <= 1 ? '1h' : '24h';
    reminders.push({
      key: `event:${event.id}:${event.date}:${event.time}:${lead}:${member.userId}`,
      userId: member.userId,
      title: lead === '1h' ? 'Your event starts soon' : 'Your upcoming event',
      body: `${event.title} starts on ${event.date} at ${event.time}${event.venue ? ' at ' + event.venue : ''}. Your ticket is ${ticket.id}.`,
      url: '/app/my-tickets',
      kind: 'event',
      ticketId: ticket.id,
      eventId: event.id,
    });
  }
  return reminders;
}
export const reminderId = (key) =>
  'NOT-' + createHash('sha256').update(key).digest('hex').slice(0, 32);
export function weeklyReminders(data, now, today) {
  const local = new Date(now.getTime() + 330 * 60000);
  if (local.getUTCDay() !== 0 || local.getUTCHours() < 9) return [];
  const upcoming = data.events
    .filter((event) => {
      const days = daysUntil(event.date, today);
      return (
        days >= 0 && days <= 7 && Date.parse(`${event.date}T${event.time}:00+05:30`) > now.getTime()
      );
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 5);
  if (!upcoming.length) return [];
  return data.members
    .filter((m) => m.userId && m.preferences?.weekly === true)
    .map((m) => ({
      key: `weekly:${m.id}:${today}`,
      userId: m.userId,
      title: 'Your club week ahead',
      body: upcoming
        .map((e) => `${e.title}: ${e.date} at ${e.time}${e.venue ? ' at ' + e.venue : ''}`)
        .join('; '),
      url: '/app/events',
      kind: 'weekly',
    }));
}
export function queueReminder(data, reminder, now) {
  const id = reminderId(reminder.key);
  if (data.notifications.some((n) => n.id === id)) return false;
  const member = data.members.find((m) => m.userId === reminder.userId);
  if (!member) return false;
  data.notifications.unshift({
    id,
    title: reminder.title,
    body: reminder.body,
    userId: member.userId,
    kind: reminder.kind,
    membershipExpires: reminder.membershipExpires,
    ticketId: reminder.ticketId,
    eventId: reminder.eventId,
    to: reminder.url,
    date: now,
    read: false,
  });
  for (const channel of [
    ...(member.preferences?.email !== false ? ['Email'] : []),
    ...(member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
  ])
    data.deliveries.unshift({
      id: `${id}-${channel}`,
      announcementId: id,
      notificationId: id,
      userId: member.userId,
      channel,
      recipient: channel === 'WhatsApp' ? member.phone : member.email,
      status: 'Prepared',
      date: now,
      title: reminder.title,
      body: reminder.body,
      url: reminder.url,
      kind: reminder.kind,
      membershipExpires: reminder.membershipExpires,
      ticketId: reminder.ticketId,
      eventId: reminder.eventId,
      detail: 'Queued for automatic delivery.',
    });
  return true;
}
