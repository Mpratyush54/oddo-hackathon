import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  CardHeader,
  Empty,
  Icon,
  LinkButton,
  Logo,
  PageHeader,
} from './components';
import { date, exportCSV, money, useStore } from './store';
import { roleLabels, useSession } from './session';
import type { Role } from './session';
import { AdminDashboard } from './pages/AdminDashboard';
import { MembersPage, TasksPage } from './pages/Community';
import { AccountSettings } from './pages/AccountSettings';
import { EventsPage, CheckoutPage, CheckInPage } from './pages/Commerce';
import { EventDiscovery } from './pages/EventDiscovery';
import EventExperience from './pages/EventExperience';
import CampusCalendar from './pages/CampusCalendar';
import { ShopPage } from './pages/Shop';
import { FinancePage } from './pages/Finance';
import { CommunicationsPage } from './pages/Communications';
import {
  CollegeDashboard,
  RoleDashboard,
  PersonalProfile,
  MemberCard,
  MyTickets,
  MyOrders,
} from './pages/Portal';
import './workspace.css';

type NavItem = { to: string; label: string; icon: string; permission?: string };
const operational: NavItem[] = [
  { to: '/app', label: 'Overview', icon: 'LayoutDashboard' },
  { to: '/app/members', label: 'Members', icon: 'UsersRound', permission: 'manage_members' },
  { to: '/app/events', label: 'Events', icon: 'CalendarDays' },
  { to: '/app/announcements', label: 'Communications', icon: 'Megaphone' },
  { to: '/app/merchandise', label: 'Merchandise', icon: 'ShoppingBag' },
  {
    to: '/app/tasks',
    label: 'Projects & tasks',
    icon: 'PanelsTopLeft',
    permission: 'manage_tasks',
  },
  { to: '/app/finance', label: 'Finances', icon: 'Wallet', permission: 'view_finance' },
  { to: '/app/audit', label: 'Activity & audit', icon: 'ShieldCheck', permission: 'audit' },
];
const personal: NavItem[] = [
  { to: '/app/profile', label: 'My profile', icon: 'UserRound' },
  { to: '/app/my-card', label: 'Membership card', icon: 'BadgeCheck' },
  { to: '/app/my-tickets', label: 'My tickets', icon: 'Ticket' },
  { to: '/app/my-orders', label: 'My orders', icon: 'Package' },
  { to: '/app/my-tasks', label: 'My tasks', icon: 'ListTodo' },
  { to: '/app/expenses', label: 'My expenses', icon: 'Receipt', permission: 'request_expense' },
];
export function Permission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useSession();
  return can(permission) ? children : <Unauthorized />;
}
function Unauthorized() {
  return (
    <section className="card access-state">
      <span className="icon-tile">
        <Icon name="ShieldCheck" size={32} />
      </span>
      <h1>This view belongs to another responsibility.</h1>
      <p>
        Your current role does not have access to this page. Choose your own workspace or another
        clearly labelled demo persona.
      </p>
      <LinkButton to="/app" icon="ArrowLeft">
        Back to my workspace
      </LinkButton>
    </section>
  );
}
function NotFound() {
  return (
    <Empty
      title="A little off the beaten path"
      description="This page does not exist. Your community is right here."
      action={
        <LinkButton to="/app" icon="ArrowLeft">
          Back to my workspace
        </LinkButton>
      }
    />
  );
}
export default function Workspace() {
  const store = useStore();
  const { data, update, toastMessage, clearToast, toast } = store;
  const session = useSession();
  const { role, user, clubId, clubs, can, signedIn, selectClub, switchPersona, signOut } = session;
  const location = useLocation(),
    navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false),
    [menu, setMenu] = useState<'account' | 'clubs' | 'notifications' | null>(null),
    [search, setSearch] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('skyline-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('skyline-theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    toast(`Switched to ${next} mode.`);
  };
  const wrapper = useRef<HTMLDivElement>(null),
    searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setMenu(null);
    setSearch('');
    window.scrollTo(0, 0);
  }, [location.pathname, clubId, role]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setMenu(null);
        setNavOpen(false);
        setSearch('');
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-popover]')) setMenu(null);
      if (!el.closest('.global-search')) setSearch('');
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);
  if (!signedIn) return <Navigate to="/login" replace />;
  const club = clubs.find((c) => c.id === clubId)!;
  const mainNav =
    role === 'college'
      ? [
          { to: '/app', label: 'Campus overview', icon: 'LayoutDashboard' },
          { to: '/app/college-clubs', label: 'Club registry', icon: 'UsersRound' },
          { to: '/app/club-summary', label: 'Selected club', icon: 'PanelsTopLeft' },
        ]
      : operational.filter((n) => !n.permission || can(n.permission));
  const managementNav = mainNav.filter(
    (item) => !['/app', '/app/events', '/app/announcements', '/app/merchandise'].includes(item.to),
  );
  const primaryNav =
    role === 'college'
      ? mainNav
      : [
          ...mainNav.filter((item) =>
            ['/app', '/app/events', '/app/announcements', '/app/merchandise'].includes(item.to),
          ),
          { to: '/app/my-tickets', label: 'My tickets', icon: 'Ticket' },
          { to: '/app/calendar', label: 'Calendar', icon: 'CalendarRange' },
        ];
  const myNav =
    role === 'college' ? [] : personal.filter((n) => !n.permission || can(n.permission));
  const tools =
    role === 'college'
      ? []
      : [
          { to: '/app/calendar', label: 'Calendar', icon: 'CalendarRange' },
          ...(can('check_in')
            ? [{ to: '/app/check-in', label: 'Check-in scanner', icon: 'ScanLine' }]
            : []),
        ];
  const visibleNotifications = data.notifications.filter((n) => {
    if (n.to.includes('@')) return n.to.toLowerCase() === user.email.toLowerCase();
    if (!n.audience || can('publish_announcement')) return true;
    const m = data.members.find((m) => m.email === user.email);
    return (
      !!m &&
      (n.audience === 'All members' ||
        (n.audience === 'Volunteers' && m.role === 'Volunteer') ||
        (n.audience === 'Active members' && m.status === 'Active') ||
        (n.audience === 'Pending dues' && m.status === 'Pending') ||
        (n.audience === 'Renewing soon' && m.status === 'Expiring'))
    );
  });
  const unread = visibleNotifications.filter((n) => !n.read).length;
  const results = [...mainNav, ...myNav, ...tools]
    .map((n) => ({ title: n.label, to: n.to, icon: n.icon, meta: 'Workspace' }))
    .concat(
      role === 'college'
        ? []
        : data.events.map((e) => ({
            title: e.title,
            to: `/app/events/${e.id}`,
            icon: 'CalendarDays',
            meta: 'Event',
          })),
      can('manage_members')
        ? data.members.map((m) => ({
            title: m.name,
            to: `/app/members?q=${encodeURIComponent(m.name)}`,
            icon: 'UserRound',
            meta: 'Member',
          }))
        : [],
    )
    .filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 7);
  const renderNav = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink
        end={item.to === '/app'}
        key={item.to}
        to={item.to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        title={item.label}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {item.to === '/app/announcements' && (
          <span className="nav-count">{data.announcements.length}</span>
        )}
      </NavLink>
    ));
  const changeClub = (id: string) => {
    selectClub(id);
    setMenu(null);
    navigate(role === 'college' ? '/app/club-summary' : '/app');
    toast(`Workspace switched to ${clubs.find((c) => c.id === id)?.name}.`);
  };
  return (
    <div className={`app-shell workspace-v2 ${navOpen ? 'navigation-open' : ''}`} ref={wrapper}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside id="workspace-navigation" className={`sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="sidebar-fixed-top">
          <div className="sidebar-brand">
            <Logo to="/app" />
            <button
              className="mobile-close icon-button"
              aria-label="Close navigation"
              onClick={() => {
                setNavOpen(false);
              }}
            >
              <Icon name="X" />
            </button>
          </div>
          <div className="club-switch-wrap" data-popover>
            <button
              className="org-switch"
              aria-expanded={menu === 'clubs'}
              aria-label="Switch organization"
              onClick={() => setMenu(menu === 'clubs' ? null : 'clubs')}
            >
              <span className={`org-symbol ${club.accent}`}>{club.name[0]}</span>
              <span>
                <strong>{club.name}</strong>
                <small>{role === 'college' ? 'College administration' : roleLabels[role]}</small>
              </span>
              <Icon name="ChevronsUpDown" size={15} />
            </button>
            {menu === 'clubs' && (
              <div className="club-popover">
                <div className="popover-label">YOUR CAMPUS COMMUNITIES</div>
                {clubs.map((c) => (
                  <button
                    key={c.id}
                    className={`club-option ${c.id === clubId ? 'selected' : ''}`}
                    onClick={() => changeClub(c.id)}
                  >
                    <span className={`org-symbol ${c.accent}`}>{c.name[0]}</span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.id === clubId ? 'Current workspace' : 'Switch workspace'}</small>
                    </span>
                    {c.id === clubId && <Icon name="Check" size={16} />}
                  </button>
                ))}
                <Link to="/clubs">
                  <Icon name="Search" size={16} />
                  Discover clubs
                  <Icon name="ArrowUpRight" size={15} />
                </Link>
                {role === 'college' && (
                  <Link to="/app/college">
                    <Icon name="LayoutDashboard" size={16} />
                    College overview
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="sidebar-scroll">
          <div className="nav-group-label">
            {role === 'college' ? 'COLLEGE WORKSPACE' : 'CLUB WORKSPACE'}
          </div>
          <nav className="primary-nav" aria-label="Main navigation">
            {renderNav(primaryNav)}
          </nav>
          {managementNav.length > 0 && role !== 'college' && (
            <details
              className="nav-section"
              open={managementNav.some((item) => location.pathname.startsWith(item.to))}
            >
              <summary>
                Club management
                <Icon name="ChevronDown" size={15} />
              </summary>
              <nav className="primary-nav" aria-label="Club management">
                {renderNav(managementNav)}
                {renderNav(tools.filter((item) => item.to !== '/app/calendar'))}
              </nav>
            </details>
          )}
          {myNav.length > 0 && (
            <details
              className="nav-section"
              open={myNav
                .filter((item) => item.to !== '/app/my-tickets')
                .some((item) => location.pathname === item.to)}
            >
              <summary>
                My account
                <Icon name="ChevronDown" size={15} />
              </summary>
              <nav className="primary-nav" aria-label="Personal navigation">
                {renderNav(myNav.filter((item) => item.to !== '/app/my-tickets'))}
              </nav>
            </details>
          )}
        </div>
        <div className="sidebar-fixed-bottom">
          <NavLink
            to="/app/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="Settings2" />
            <span>Account settings</span>
          </NavLink>
          <Link to="/" className="nav-item">
            <Icon name="ArrowUpRight" />
            <span>Public website</span>
          </Link>
          <div className="sidebar-footer">
            <span className="live-dot" />
            Local demo · data saved on this device
          </div>
        </div>
      </aside>
      <nav className="mobile-quick-nav" aria-label="Quick navigation">
        {(role === 'college'
          ? [
              { to: '/app/college', label: 'Campus', icon: 'LayoutDashboard' },
              { to: '/app/college-clubs', label: 'Clubs', icon: 'UsersRound' },
              { to: '/app/settings', label: 'Settings', icon: 'Settings2' },
            ]
          : [
              { to: '/app', label: 'Home', icon: 'LayoutDashboard' },
              { to: '/app/events', label: 'Events', icon: 'CalendarDays' },
              { to: '/app/my-tickets', label: 'Tickets', icon: 'Ticket' },
              { to: '/app/profile', label: 'You', icon: 'UserRound' },
            ]
        ).map((item) => (
          <NavLink key={item.to} to={item.to} end>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label={navOpen ? 'Collapse navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            aria-controls="workspace-navigation"

            onClick={() => setNavOpen((open) => !open)}
          >
            <Icon name="Menu" />
          </button>
          <Link to="/app" className="workspace-home">
            skyline<span className="brand-dot">.</span>
          </Link>
          <div className="global-search">
            <Icon name="Search" size={19} />
            <input
              ref={searchRef}
              aria-label="Search your workspace"
              placeholder="Search your workspace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) navigate(results[0].to);
              }}
            />
            <kbd>Ctrl K</kbd>
            {search && (
              <div className="search-results">
                {results.length ? (
                  results.map((r) => (
                    <Link to={r.to} key={r.to}>
                      <Icon name={r.icon} size={18} />
                      <span>
                        {r.title}
                        <small>{r.meta}</small>
                      </span>
                      <Icon name="ArrowUpRight" size={15} />
                    </Link>
                  ))
                ) : (
                  <p>No matching records.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label="Toggle color theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={18} />
            </button>
            <span className="demo-role-pill">
              <span className="live-dot" />
              {roleLabels[role]}
            </span>
            <div className="notification-wrap" data-popover>
              <button
                className="notification-button icon-button"
                aria-label="Notifications"
                aria-expanded={menu === 'notifications'}
                onClick={() => setMenu(menu === 'notifications' ? null : 'notifications')}
              >
                <Icon name="Bell" />
                {unread > 0 && <span className="notification-dot pulse-ring" />}
              </button>
              {menu === 'notifications' && (
                <div className="notification-popover">
                  <CardHeader
                    title="Your updates"
                    action={
                      <button
                        className="text-link"
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            notifications: d.notifications.map((n) =>
                              visibleNotifications.some((v) => v.id === n.id)
                                ? { ...n, read: true }
                                : n,
                            ),
                          }))
                        }
                      >
                        Mark all read
                      </button>
                    }
                  />
                  {visibleNotifications.length ? (
                    visibleNotifications.slice(0, 5).map((n) => (
                      <Link
                        key={n.id}
                        to={n.to.startsWith('/app') ? n.to : '/app/my-tickets'}
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            notifications: d.notifications.map((v) =>
                              v.id === n.id ? { ...v, read: true } : v,
                            ),
                          }))
                        }
                      >
                        <span className="icon-tile">
                          <Icon name="Bell" />
                        </span>
                        <span>
                          <strong>{n.title}</strong>
                          <small>{n.body.slice(0, 100)}</small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="muted">You’re all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="account-wrap" data-popover>
              <button
                className="user-chip"
                aria-label="Open account menu"
                aria-expanded={menu === 'account'}
                onClick={() => setMenu(menu === 'account' ? null : 'account')}
              >
                <Avatar name={user.name} />
                <span>
                  <strong>{user.name}</strong>
                  <small>{roleLabels[role]}</small>
                </span>
                <Icon name="ChevronDown" size={16} />
              </button>
              {menu === 'account' && (
                <div className="account-popover">
                  <div className="account-summary">
                    <Avatar name={user.name} />
                    <div>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  {[
                    ['UserRound', 'My profile', '/app/profile'],
                    ...(role === 'college'
                      ? []
                      : [
                          ['BadgeCheck', 'Membership card', '/app/my-card'],
                          ['Ticket', 'Tickets & orders', '/app/my-tickets'],
                        ]),
                    ['Settings2', 'Account settings', '/app/settings'],
                  ].map(([icon, label, to]) => (
                    <Link key={to} to={to}>
                      <Icon name={icon} size={17} />
                      {label}
                    </Link>
                  ))}
                  <div className="persona-section">
                    <div className="popover-label">EXPLORE A DEMO PERSONA</div>
                    {(['member', 'organizer', 'treasurer', 'admin', 'college'] as Role[]).map(
                      (r) => (
                        <button
                          key={r}
                          className={role === r ? 'selected' : ''}
                          onClick={() => {
                            switchPersona(r);
                            navigate(r === 'college' ? '/app/college' : '/app');
                            setMenu(null);
                          }}
                        >
                          <Icon
                            name={
                              r === 'college'
                                ? 'UsersRound'
                                : r === 'treasurer'
                                  ? 'Wallet'
                                  : r === 'organizer'
                                    ? 'CalendarDays'
                                    : r === 'member'
                                      ? 'UserRound'
                                      : 'ShieldCheck'
                            }
                            size={16}
                          />
                          {roleLabels[r]}
                          {role === r && <Icon name="Check" size={14} />}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="sign-out"
                    onClick={() => {
                      signOut();
                      navigate('/');
                    }}
                  >
                    <Icon name="ArrowLeft" size={17} />
                    Sign out of demo
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="content" key={`${clubId}:${role}`}>
          <Routes>
            <Route
              index
              element={
                role === 'college' ? (
                  <CollegeDashboard />
                ) : role === 'admin' ? (
                  <AdminDashboard />
                ) : (
                  <RoleDashboard />
                )
              }
            />
            <Route
              path="members"
              element={
                <Permission permission="manage_members">
                  <MembersPage />
                </Permission>
              }
            />
            <Route
              path="events/manage"
              element={
                <Permission permission="manage_events">
                  <EventsPage />
                </Permission>
              }
            />
            <Route
              path="events"
              element={role === 'college' ? <Unauthorized /> : <EventDiscovery />}
            />
            <Route
              path="events/:id"
              element={role === 'college' ? <Unauthorized /> : <EventExperience />}
            />
            <Route
              path="announcements"
              element={role === 'college' ? <Unauthorized /> : <CommunicationsPage />}
            />
            <Route
              path="merchandise"
              element={role === 'college' ? <Unauthorized /> : <ShopPage />}
            />
            <Route
              path="tasks"
              element={
                <Permission permission="manage_tasks">
                  <TasksPage />
                </Permission>
              }
            />
            <Route path="projects" element={<Navigate to="/app/tasks" replace />} />
            <Route path="my-tasks" element={<PersonalTasks />} />
            <Route
              path="finance"
              element={
                <Permission permission="view_finance">
                  <FinancePage />
                </Permission>
              }
            />
            <Route path="finances" element={<Navigate to="/app/finance" replace />} />
            <Route
              path="expenses"
              element={
                <Permission permission="request_expense">
                  <FinancePage />
                </Permission>
              }
            />
            <Route
              path="audit"
              element={
                <Permission permission="audit">
                  <AuditPage />
                </Permission>
              }
            />
            <Route path="calendar" element={<CampusCalendar />} />
            <Route path="settings" element={<AccountSettings />} />
            <Route
              path="check-in"
              element={
                <Permission permission="check_in">
                  <CheckInPage />
                </Permission>
              }
            />
            <Route
              path="checkout"
              element={
                <Permission permission="book_ticket">
                  <CheckoutPage />
                </Permission>
              }
            />
            <Route path="profile" element={<PersonalProfile />} />
            <Route path="my-card" element={<MemberCard />} />
            <Route path="my-tickets" element={<MyTickets />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route
              path="college"
              element={
                <Permission permission="college_overview">
                  <CollegeDashboard />
                </Permission>
              }
            />
            <Route
              path="college-clubs"
              element={
                <Permission permission="manage_clubs">
                  <CollegeRegistry />
                </Permission>
              }
            />
            <Route
              path="club-summary"
              element={
                <Permission permission="college_overview">
                  <ClubSummary />
                </Permission>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="content-footer">
            <span>One campus. Your community. Everything connected.</span>
            <span>
              Demo workspace <Icon name="Heart" size={12} />
            </span>
          </footer>
        </main>
      </div>
      {toastMessage && (
        <div className="toast" role="status">
          <Icon name="CircleCheck" />
          <span>{toastMessage}</span>
          <button aria-label="Dismiss notification" onClick={clearToast}>
            <Icon name="X" size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function PersonalTasks() {
  const { data, update, toast } = useStore();
  const { user } = useSession();
  const tasks = data.tasks.filter((t) => t.assignee === user.name);
  return (
    <>
      <PageHeader
        title="Your part in the bigger picture"
        eyebrow="YOUR VOLUNTEER WORK"
        description="A clear next step, and a team counting on you."
      />
      <div className="personal-task-grid">
        {tasks.map((t) => (
          <section className="card" key={t.id}>
            <Badge tone={t.status === 'Done' ? 'green' : 'gold'}>{t.status}</Badge>
            <h2>{t.title}</h2>
            <p>{t.description}</p>
            <small>
              Due {date(t.due)} · {t.priority} priority
            </small>
            <Button
              icon={t.status === 'Done' ? 'CircleCheck' : 'Check'}
              disabled={t.status === 'Done'}
              onClick={() => {
                update((d) => ({
                  ...d,
                  tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status: 'Done' } : x)),
                }));
                toast('Your task is complete. Thanks for showing up.');
              }}
            >
              Mark complete
            </Button>
          </section>
        ))}
      </div>
      {!tasks.length && (
        <Empty
          title="A little room for something new"
          description="Your assigned tasks will appear here."
        />
      )}
    </>
  );
}
function AuditPage() {
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const entries = data.audit.filter((a) =>
    `${a.actor} ${a.detail} ${a.action}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTABILITY, BUILT IN"
        title="Activity & audit"
        description="Who changed what, and when. A clear record for your club."
        action={
          <Button
            variant="secondary"
            icon="Download"
            onClick={() =>
              exportCSV('skyline-audit.csv', [
                ['Time', 'Actor', 'Action', 'Entity', 'Reference', 'Details'],
                ...entries.map((a) => [a.date, a.actor, a.action, a.entity, a.entityId, a.detail]),
              ])
            }
          >
            Export log
          </Button>
        }
      />
      <div className="info-banner audit-note">
        <Icon name="ShieldCheck" />
        <p>
          This local demo records business changes automatically. AWS deployment will write audit
          records on the server; browser storage is editable and is not a tamper-proof log.
        </p>
      </div>
      <section className="card table-card">
        <div className="table-toolbar">
          <h2>{entries.length} recorded actions</h2>
          <input
            className="audit-search"
            placeholder="Search actor or action..."
            aria-label="Search audit log"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.actor}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={
                        a.action === 'Rejected' ? 'red' : a.action === 'Approved' ? 'green' : 'teal'
                      }
                    >
                      {a.action}
                    </Badge>
                  </td>
                  <td>
                    {a.entity}
                    <small className="cell-subtext">{a.entityId}</small>
                  </td>
                  <td>{a.detail}</td>
                  <td>
                    {new Date(a.date).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && (
          <Empty
            title="The next action starts the story"
            description="Create a record or review an expense to see the audit trail."
          />
        )}
      </section>
    </>
  );
}
function CollegeRegistry() {
  const { organizations, allClubs, selectClub } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="CAMPUS ADMINISTRATION"
        title="Student organization registry"
        description="Independent clubs. One connected campus."
      />
      <section className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Memberships</th>
                <th>Events</th>
                <th>Recorded balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <small className="cell-subtext">{o.description.slice(0, 70)}</small>
                  </td>
                  <td>{allClubs[o.id].members.length}</td>
                  <td>{allClubs[o.id].events.length}</td>
                  <td>
                    {money(
                      allClubs[o.id].transactions
                        .filter((t) => t.status === 'Completed')
                        .reduce((s, t) => s + t.amount, 0),
                    )}
                  </td>
                  <td>
                    <Badge tone="green">Registered</Badge>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      icon="ArrowUpRight"
                      onClick={() => {
                        selectClub(o.id);
                        navigate('/app/club-summary');
                      }}
                    >
                      Review summary
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="info-banner">
        <Icon name="ShieldCheck" />
        <p>
          College administrators see organization summaries. Personal receipts and membership
          details stay within authorized club workspaces.
        </p>
      </div>
    </>
  );
}
function ClubSummary() {
  const { data, organizations, selectedClub } = useStore();
  const club = organizations.find((o) => o.id === selectedClub)!;
  return (
    <>
      <PageHeader
        eyebrow="COLLEGE VIEW · CLUB SUMMARY"
        title={club.name}
        description={club.description}
      />
      <div className="four-stats">
        {[
          ['Memberships', data.members.length],
          ['Upcoming events', data.events.length],
          ['Volunteer tasks', data.tasks.length],
          ['Completed tasks', data.tasks.filter((t) => t.status === 'Done').length],
        ].map(([label, value]) => (
          <section className="card summary-stat" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      <section className="card">
        <CardHeader
          title="Event calendar"
          subtitle="Public event readiness and campus scheduling."
        />
        {data.events.map((e) => (
          <div className="summary-event" key={e.id}>
            <div>
              <strong>{e.title}</strong>
              <small>
                {date(e.date)} · {e.venue}
              </small>
            </div>
            <Badge tone={e.sold >= e.capacity ? 'gold' : 'green'}>
              {e.sold}/{e.capacity} reserved
            </Badge>
          </div>
        ))}
      </section>
      <div className="info-banner">
        <Icon name="ShieldCheck" />
        <p>This summary does not expose student contact details or private receipts.</p>
      </div>
    </>
  );
}
