export const daysUntil = (expires, today) =>
  Math.round((Date.parse(expires) - Date.parse(today)) / 86400000);
export function renewingSoon(member, today) {
  const days = daysUntil(member.expires, today);
  return (
    !member.refundPending &&
    ['Active', 'Expiring'].includes(member.status) &&
    days >= 0 &&
    days <= 30
  );
}
