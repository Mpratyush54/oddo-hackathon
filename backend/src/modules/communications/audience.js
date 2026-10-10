export function matchesAudience(member, audience) {
  return (
    audience === 'All members' ||
    (audience === 'Active members' && member.status === 'Active') ||
    (audience === 'Volunteers' && member.role === 'Volunteer') ||
    (audience === 'Pending dues' && member.status === 'Pending') ||
    (audience === 'Renewing soon' && member.status === 'Expiring')
  );
}
