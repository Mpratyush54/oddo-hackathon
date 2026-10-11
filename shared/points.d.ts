type MemberPoints = {
  id: string;
  participationPoints?: number;
  volunteerPoints?: number;
  contributionPoints?: number;
};
type LedgerPoints = { memberId: string; kind: string; points: number };
export function availablePoints(member: MemberPoints | undefined, ledger?: LedgerPoints[]): number;
export function pointsDiscount(
  amount: number,
  requestedPoints: number,
  valuePaise?: number,
): { pointsRedeemed: number; pointsDiscount: number };
