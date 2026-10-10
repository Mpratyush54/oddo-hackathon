export function hasActiveMembership(
  member: { status: string; expires: string; refundPending?: boolean } | null | undefined,
  today: string,
): boolean;
