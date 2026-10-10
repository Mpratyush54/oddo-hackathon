import './workspace.css';

export type NavItem = { to: string; label: string; icon: string; permission?: string };

export const operational: NavItem[] = [
  { to: '/app', label: 'Overview', icon: 'LayoutDashboard' },
  { to: '/app/users', label: 'Users & access', icon: 'UsersRound', permission: 'manage_members' },
  { to: '/app/members', label: 'Members', icon: 'UsersRound', permission: 'manage_members' },
  { to: '/app/events', label: 'Events', icon: 'CalendarDays' },
  { to: '/app/announcements', label: 'Communications', icon: 'Megaphone' },
  { to: '/app/merchandise', label: 'Merchandise', icon: 'ShoppingBag' },
  { to: '/app/contributions', label: 'Points & promos', icon: 'HeartHandshake' },
  {
    to: '/app/tasks',
    label: 'Projects & tasks',
    icon: 'PanelsTopLeft',
    permission: 'manage_tasks',
  },
  { to: '/app/finance', label: 'Finances', icon: 'Wallet', permission: 'view_finance' },
  { to: '/app/audit', label: 'Activity & audit', icon: 'ShieldCheck', permission: 'audit' },
];

export const personal: NavItem[] = [
  { to: '/app/profile', label: 'My profile', icon: 'UserRound' },
  { to: '/app/my-card', label: 'Membership card', icon: 'BadgeCheck' },
  { to: '/app/my-tickets', label: 'My tickets', icon: 'Ticket' },
  { to: '/app/my-orders', label: 'My orders', icon: 'Package' },
  { to: '/app/my-tasks', label: 'My tasks', icon: 'ListTodo' },
  { to: '/app/expenses', label: 'My expenses', icon: 'Receipt', permission: 'request_expense' },
];
