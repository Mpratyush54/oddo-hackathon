/** One eligibility rule for member prices, cards and checkout. Dates are ISO calendar dates. */
export function hasActiveMembership(member, today) {
  return Boolean(
    member &&
    ['Active', 'Expiring'].includes(member.status) &&
    !member.refundPending &&
    member.expires >= today,
  );
}
