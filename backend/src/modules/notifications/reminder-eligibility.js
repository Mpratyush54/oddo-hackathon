export function reminderEligible(data, member, reminder, now = Date.now()) {
  if (reminder.kind === 'weekly') return member.preferences?.weekly === true;
  if (reminder.kind === 'membership')
    return (
      member.preferences?.renewals !== false &&
      !member.refundPending &&
      (!reminder.membershipExpires || reminder.membershipExpires === member.expires) &&
      (!reminder.title?.includes('dues') || member.status === 'Pending')
    );
  if (reminder.kind === 'event') {
    const ticket = data.tickets.find(
      (t) => t.id === reminder.ticketId && t.userId === member.userId,
    );
    const event = data.events.find((e) => e.id === reminder.eventId);
    return (
      member.preferences?.events !== false &&
      !!ticket &&
      !ticket.checkedIn &&
      !ticket.refundPending &&
      ticket.status !== 'Cancelled' &&
      !!event &&
      Date.parse(`${event.date}T${event.time}:00+05:30`) > now
    );
  }
  return true;
}
