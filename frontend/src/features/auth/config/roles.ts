import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';

export const roles = [
  {
    role: 'member',
    title: 'Student & volunteer',
    text: 'My membership, tickets and assignments',
    icon: 'UserRound',
  },
  {
    role: 'organizer',
    title: 'Event organizer',
    text: 'Event readiness, guests and check-in',
    icon: 'CalendarDays',
  },
  {
    role: 'treasurer',
    title: 'Treasurer',
    text: 'Ledger, receipts and income — approvals stay with the club admin',
    icon: 'Wallet',
  },
  {
    role: 'admin',
    title: 'Club president',
    text: 'People, events, expense approvals and the whole club',
    icon: 'ShieldCheck',
  },
  {
    role: 'college',
    title: 'College administrator',
    text: 'A clear view across campus clubs',
    icon: 'Globe',
  },
] as const;
