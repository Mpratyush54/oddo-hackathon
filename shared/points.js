/** Earned scores stay on the leaderboard; redemptions affect only the spendable wallet. */
export function availablePoints(member, ledger = []) {
  if (!member) return 0;
  const earned =
    (member.participationPoints || 0) +
    (member.volunteerPoints || 0) +
    (member.contributionPoints || 0);
  const spent = ledger
    .filter((entry) => entry.memberId === member.id && entry.kind === 'redemption')
    .reduce((sum, entry) => sum + entry.points, 0);
  return Math.max(0, Math.floor(earned + spent));
}

export function pointsDiscount(amount, requestedPoints, valuePaise = 100) {
  const pricePaise = Math.max(0, Math.round(amount * 100));
  const pointsRedeemed = Math.min(requestedPoints, Math.floor(pricePaise / valuePaise));
  return { pointsRedeemed, pointsDiscount: (pointsRedeemed * valuePaise) / 100 };
}
