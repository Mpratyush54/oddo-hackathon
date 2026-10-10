export function daysUntil(expires: string, today: string): number;
export function renewingSoon(
  member: { expires: string; status: string; refundPending?: boolean },
  today: string,
): boolean;
