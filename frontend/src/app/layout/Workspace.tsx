import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { CardHeader } from '../../shared/ui/CardHeader';
import { Empty } from '../../shared/ui/Empty';
import { Icon } from '../../shared/ui/Icon';
import { LinkButton } from '../../shared/ui/LinkButton';
import { Logo } from '../../shared/ui/Logo';
import { useStore } from '../state/StoreProvider';
import { roleLabels, useSession } from '../../features/auth/session';
import { backendPost, cloudMode } from '../../shared/api/client';
import type { Role } from '../../features/auth/session';
import { AdminDashboard } from '../../features/admin/pages/Dashboard';
import { EmailVerificationNotice } from '../../features/auth/EmailVerificationNotice';
import { PeoplePage } from '../../features/membership/pages/PeoplePage';
import { TasksPage } from '../../features/tasks/pages/TasksPage';
import { EventsPage } from '../../features/events/pages/EventsPage';
import { CheckoutPage } from '../../features/commerce/pages/CheckoutPage';
import { CheckInPage } from '../../features/tickets/pages/CheckInPage';
import { EventDiscovery } from '../../features/events/pages/EventDiscovery';
import EventExperience from '../../features/events/pages/EventExperience';
import CampusCalendar from '../../features/events/pages/Calendar';
import { ShopPage } from '../../features/shop/pages/Shop';
import { ContributionsPage } from '../../features/contributions/pages/Contributions';
import { FinancePage } from '../../features/finance/pages/Finance';
import { CommunicationsPage } from '../../features/communications/pages/Communications';
import { CollegeDashboard } from '../../features/college/pages/CollegeDashboard';
import { RoleDashboard } from '../../features/dashboard/pages/RoleDashboard';
import { PersonalProfile } from '../../features/account/pages/Profile';
import { MemberCard } from '../../features/membership/pages/MemberCard';
import { MyTickets } from '../../features/tickets/pages/MyTickets';
import { MyOrders } from '../../features/commerce/pages/MyOrders';
import './workspace.css';
import type { NavItem } from './navigation';
import { operational, personal } from './navigation';
import { Permission, Unauthorized } from '../routes/Permission';
import { PersonalTasks } from '../../features/tasks/pages/MyTasks';
import { actionLabels, AuditPage } from '../../features/audit/pages/AuditPage';
import { CollegeRegistry } from '../../features/college/pages/Registry';
import { ClubSummary } from '../../features/college/pages/ClubSummary';

export function NotFound() {
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
  const isDesktop = () => window.matchMedia('(min-width: 769px)').matches;
  const [navOpen, setNavOpen] = useState(() =>
    typeof window !== 'undefined' ? isDesktop() : true,
  ),
    [phoneViewport, setPhoneViewport] = useState(
      () => (typeof window !== 'undefined' ? !isDesktop() : false),
    ),
    [menu, setMenu] = useState<'account' | 'clubs' | 'notifications' | null>(null),
    [search, setSearch] = useState('');
  const wrapper = useRef<HTMLDivElement>(null),
    searchRef = useRef<HTMLInputElement>(null);
  const phoneDrawerOpen = phoneViewport && navOpen;
  useEffect(() => {
    setMenu(null);
    setSearch('');
    // Phone drawer closes on navigate; desktop collapse state is sticky.
    if (!isDesktop()) setNavOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname, clubId, role]);
  useEffect(() => {
    if (!phoneDrawerOpen) return;
    setMenu(null);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phoneDrawerOpen]);
  useEffect(() => {
    const onResize = () => {
      const desktop = isDesktop();
      setPhoneViewport(!desktop);
      setNavOpen(desktop);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (phoneDrawerOpen) return;
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setMenu(null);
        setSearch('');
        // Escape dismisses the phone drawer only — desktop uses the toggle button.
        if (phoneViewport) setNavOpen(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [phoneDrawerOpen, phoneViewport]);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-popover]')) setMenu(null);
      if (!el.closest('.global-search')) setSearch('');
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);
  if (!session.ready)
    return (
      <div className="portal-note" role="status">
        Loading your campus account…
      </div>
    );
  if (!signedIn) return <Navigate to="/login" replace />;
  const club = clubs.find((c) => c.id === clubId)!;
  const merchNavLabel = can('manage_inventory')
    ? 'Merch stock'
    : can('manage_orders')
      ? 'Merch orders'
      : 'Merch';
  const merchNavIcon = can('manage_inventory') || can('manage_orders') ? 'Package' : 'ShoppingBag';
  const mainNav =
    role === 'college'
      ? [
        { to: '/app', label: 'Campus overview', icon: 'LayoutDashboard' },
        { to: '/app/college-clubs', label: 'Club registry', icon: 'UsersRound' },
        { to: '/app/club-summary', label: 'Selected club', icon: 'PanelsTopLeft' },
      ]
      : operational
        .filter((n) => !n.permission || can(n.permission))
        .map((n) =>
          n.to === '/app/merchandise' ? { ...n, label: merchNavLabel, icon: merchNavIcon } : n,
        );
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
    role === 'college'
      ? [{ to: '/app/profile', label: 'My profile', icon: 'UserRound' }]
      : personal.filter((n) => !n.permission || can(n.permission));
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
  const searchQuery = search.trim().toLowerCase();
  type SearchHit = { id: string; title: string; to: string; icon: string; meta: string; hint?: string };
  const results: SearchHit[] = (() => {
    if (!searchQuery) return [];
    const hits: SearchHit[] = [];
    const push = (hit: SearchHit) => {
      const hay = `${hit.title} ${hit.meta} ${hit.hint || ''}`.toLowerCase();
      if (hay.includes(searchQuery)) hits.push(hit);
    };
    [...mainNav, ...myNav, ...tools].forEach((n) =>
      push({ id: `page-${n.to}`, title: n.label, to: n.to, icon: n.icon, meta: 'Page' }),
    );
    if (role !== 'college') {
      data.events.forEach((e) =>
        push({
          id: `event-${e.id}`,
          title: e.title,
          to: `/app/events/${e.id}`,
          icon: 'CalendarDays',
          meta: 'Event',
          hint: `${e.venue} ${e.category} ${e.date}`,
        }),
      );
      data.products.forEach((p) =>
        push({
          id: `product-${p.id}`,
          title: p.name,
          to: '/app/merchandise',
          icon: 'ShoppingBag',
          meta: 'Product',
          hint: p.type,
        }),
      );
      data.announcements.forEach((a) =>
        push({
          id: `announcement-${a.id}`,
          title: a.title,
          to: '/app/announcements',
          icon: 'Megaphone',
          meta: 'Announcement',
          hint: a.body?.slice(0, 80),
        }),
      );
      data.tickets
        .filter((t) => t.email.toLowerCase() === user.email.toLowerCase())
        .forEach((t) => {
          const eventTitle = data.events.find((e) => e.id === t.eventId)?.title || t.id;
          push({
            id: `ticket-${t.id}`,
            title: eventTitle,
            to: '/app/my-tickets',
            icon: 'Ticket',
            meta: 'My ticket',
            hint: t.id,
          });
        });
      data.orders
        .filter(
          (o) =>
            o.email?.toLowerCase() === user.email.toLowerCase() ||
            o.name === user.name ||
            can('manage_orders') ||
            can('manage_inventory'),
        )
        .forEach((o) =>
          push({
            id: `order-${o.id}`,
            title: o.id,
            to: can('manage_orders') || can('manage_inventory') ? '/app/merchandise' : '/app/my-orders',
            icon: 'Package',
            meta: 'Order',
            hint: `${o.name} ${o.email || ''} ${o.size || ''}`,
          }),
        );
      data.tasks
        .filter((t) => t.assignee === user.name || can('manage_tasks'))
        .forEach((t) =>
          push({
            id: `task-${t.id}`,
            title: t.title,
            to: can('manage_tasks') ? '/app/tasks' : '/app/my-tasks',
            icon: 'ListTodo',
            meta: 'Task',
            hint: `${t.assignee} ${t.status}`,
          }),
        );
    }
    if (can('manage_members')) {
      data.members.forEach((m) =>
        push({
          id: `member-${m.id}`,
          title: m.name,
          to: `/app/members?q=${encodeURIComponent(m.name)}`,
          icon: 'UserRound',
          meta: 'Member',
          hint: `${m.email} ${m.course} ${m.status}`,
        }),
      );
    }
    if (can('view_finance')) {
      data.transactions.forEach((t) =>
        push({
          id: `tx-${t.id}`,
          title: t.title,
          to: '/app/finance',
          icon: 'Wallet',
          meta: 'Finance',
          hint: `${t.category} ${t.status} ${t.id}`,
        }),
      );
    }
    if (can('audit')) {
      data.audit.forEach((a) =>
        push({
          id: `audit-${a.id}`,
          title: actionLabels[a.action] || a.action,
          to: `/app/audit?q=${encodeURIComponent(a.actor || a.detail || a.action)}`,
          icon: 'ShieldCheck',
          meta: 'Audit',
          hint: `${a.actor} ${a.detail} ${a.entity}`,
        }),
      );
    }
    return hits.slice(0, 12);
  })();
  const renderNav = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink
        end={item.to === '/app'}
        key={item.to}
        to={item.to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        title={item.label}
        onClick={() => {
          if (!isDesktop()) setNavOpen(false);
        }}
      >
        <Icon name={item.icon} size={22} />
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
      {phoneDrawerOpen && (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${navOpen ? 'is-open' : ''}`}
        aria-hidden={phoneViewport && !navOpen ? true : undefined}
      >
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
          <div className="sidebar-footer">
            <span className="live-dot" />
            {cloudMode
              ? 'AWS workspace · shared campus data'
              : 'Local demo · data saved on this device'}
          </div>
        </div>
      </aside>
      <nav className="mobile-quick-nav" aria-label="Quick navigation">
        {(role === 'college'
          ? [
            { to: '/app/college', label: 'Campus', icon: 'LayoutDashboard' },
            { to: '/app/college-clubs', label: 'Clubs', icon: 'UsersRound' },
            { to: '/app/profile', label: 'You', icon: 'UserRound' },
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
      <div
        className="main-shell"
        inert={phoneDrawerOpen ? true : undefined}
        aria-hidden={phoneDrawerOpen ? true : undefined}
      >
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
              placeholder="Search people, events, orders, pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) {
                  navigate(results[0].to);
                  setSearch('');
                }
              }}
            />
            <kbd>Ctrl K</kbd>
            {searchQuery && (
              <div className="search-results">
                {results.length ? (
                  results.map((r) => (
                    <Link to={r.to} key={r.id} onClick={() => setSearch('')}>
                      <Icon name={r.icon} size={18} />
                      <span>
                        {r.title}
                        <small>
                          {r.meta}
                          {r.hint ? ` · ${r.hint}` : ''}
                        </small>
                      </span>
                      <Icon name="ArrowUpRight" size={15} />
                    </Link>
                  ))
                ) : (
                  <p>No matching records across the workspace.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
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
                  ].map(([icon, label, to]) => (
                    <Link key={to} to={to}>
                      <Icon name={icon} size={17} />
                      {label}
                    </Link>
                  ))}
                  {!cloudMode && (
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
                  )}
                  <button
                    className="sign-out"
                    onClick={() => {
                      signOut();
                      navigate('/');
                    }}
                  >
                    <Icon name="ArrowLeft" size={17} />
                    {cloudMode ? 'Sign out' : 'Sign out of demo'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="content" key={`${clubId}:${role}`}>
          {cloudMode && role !== 'college' && !data.members.some((m) => m.email === user.email) && (
            <div className="info-banner">
              <Icon name="UsersRound" />
              <div>
                <strong>Join as a student member</strong>
                <p>
                  Get your membership card, member prices, and club updates. You can activate dues
                  later from your card.
                </p>
              </div>
              <Button
                onClick={() => {
                  void backendPost<{ state: typeof data }>(`/clubs/${clubId}/actions`, {
                    type: 'membership.join',
                    args: {},
                    idempotencyKey: crypto.randomUUID(),
                  })
                    .then(() => {
                      toast('You joined the club. Open My card to see your membership.');
                      window.dispatchEvent(new Event('skyline-data-changed'));
                    })
                    .catch((error) => toast(error.message));
                }}
              >
                Join club
              </Button>
            </div>
          )}
          <EmailVerificationNotice />
          <Routes>
            <Route
              path="users"
              element={<Navigate to="/app/members?view=access" replace />}
            />
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
                  <PeoplePage />
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
              path="contributions"
              element={role === 'college' ? <Unauthorized /> : <ContributionsPage />}
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
            <Route path="settings" element={<Navigate to="/app/profile?settings=1" replace />} />
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
              {cloudMode ? 'Campus workspace' : 'Demo workspace'} <Icon name="Heart" size={12} />
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
