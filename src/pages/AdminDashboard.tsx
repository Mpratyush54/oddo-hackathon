import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  CardHeader,
  CommunityArt,
  FinanceChart,
  Icon,
  PageHeader,
  Progress,
} from '../components';
import { date, money, useStore } from '../store';
import { useSession } from '../session';
import { Revealed } from '../components/PageMotion';
export function monthlyTotals(transactions: ReturnType<typeof useStore>['data']['transactions']) {
  return ['Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, i) => {
    const rows = transactions.filter(
      (t) => t.status === 'Completed' && Number(t.date.slice(5, 7)) === i + 8,
    );
    return {
      label,
      income: rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      expense: rows.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
    };
  });
}
export function AdminDashboard() {
  const { data } = useStore();
  const { user } = useSession();
  const [range, setRange] = useState('semester'),
    [quickMenu, setQuickMenu] = useState(false);
  const completed = data.transactions.filter((t) => t.status === 'Completed');
  const total = completed.reduce((s, t) => s + t.amount, 0);
  const paid = data.members.filter((m) => m.status !== 'Pending').length;
  const pending = data.transactions.filter((t) => t.status === 'Pending');
  const pendingMembers = data.members.filter((m) => m.status === 'Pending').length;
  const upcoming = [...data.events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const done = data.tasks.filter((t) => t.status === 'Done').length;

  const chartValues =
    range === 'month'
      ? monthlyTotals(completed).filter((v) => v.label === 'Oct')
      : monthlyTotals(completed).slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="YOUR CLUB, AT A GLANCE"
        title="Overview"
        description="A good day to bring your community together."
        action={
          <>
            <Link className="button secondary date-button" to="/app/calendar">
              <Icon name="CalendarDays" size={16} />
              Oct 10, 2026
              <Icon name="ChevronDown" size={15} />
            </Link>
            <div className="quick-create">
              <Button icon="Plus" onClick={() => setQuickMenu(!quickMenu)}>
                Create new
              </Button>
              {quickMenu && (
                <div className="quick-menu">
                  {[
                    ['CalendarPlus', 'Event', '/app/events?create=true'],
                    ['UserRoundPlus', 'Member', '/app/members?create=true'],
                    ['Megaphone', 'Announcement', '/app/announcements?create=true'],
                    ['ListPlus', 'Task', '/app/tasks?create=true'],
                  ].map(([icon, label, to]) => (
                    <Link key={to} to={to}>
                      <Icon name={icon} size={18} />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />

      {/* Morning Brief Composition */}
      <Revealed>
        <section className="morning-brief-hero">
          <div className="morning-brief-content">
            <div className="morning-brief-kicker">
              <span className="tiny-sun">✷</span> SATURDAY, OCTOBER 10 • CLUB MORNING BRIEF
              <span className="morning-brief-status">
                <span className="hero-live-dot" /> Operational
              </span>
            </div>
            <h2>
              Good morning, {user.name.split(' ')[0]} <span className="wave">✦</span>
            </h2>
            <p className="morning-brief-lead">
              Small steps. Big impact. Here is where Skyline stands today — 3 priority items need your attention.
            </p>

            {/* Vital Telemetry */}
            <div className="morning-brief-stats">
              <Link to="/app/finance" className="brief-stat-pill">
                <span className="brief-stat-icon teal">
                  <Icon name="Wallet" size={20} />
                </span>
                <div>
                  <small>Treasury Balance</small>
                  <strong>{money(total)}</strong>
                </div>
              </Link>

              <Link to="/app/members" className="brief-stat-pill">
                <span className="brief-stat-icon purple">
                  <Icon name="UsersRound" size={20} />
                </span>
                <div>
                  <small>Community Strength</small>
                  <strong>
                    {data.members.length} members <span className="brief-stat-sub">({paid} active dues)</span>
                  </strong>
                </div>
              </Link>

              <Link to="/app/events" className="brief-stat-pill">
                <span className="brief-stat-icon gold">
                  <Icon name="CalendarDays" size={20} />
                </span>
                <div>
                  <small>Event Reservations</small>
                  <strong>
                    {data.events.reduce((s, e) => s + e.sold, 0)} reserved{' '}
                    <span className="brief-stat-sub">({data.events.length} events)</span>
                  </strong>
                </div>
              </Link>
            </div>

            {/* Quick module navigation strip */}
            <nav className="morning-brief-nav" aria-label="Quick club tools">
              <span className="brief-nav-label">Direct tools:</span>
              <Link to="/app/members" className="brief-nav-item">
                <Icon name="UsersRound" size={15} /> Members
              </Link>
              <Link to="/app/events" className="brief-nav-item">
                <Icon name="CalendarDays" size={15} /> Events
              </Link>
              <Link to="/app/merchandise" className="brief-nav-item">
                <Icon name="ShoppingBag" size={15} /> Store
              </Link>
              <Link to="/app/tasks" className="brief-nav-item">
                <Icon name="ListTodo" size={15} /> Projects ({done}/{data.tasks.length})
              </Link>
              <Link to="/app/finance" className="brief-nav-item">
                <Icon name="Landmark" size={15} /> Ledger
              </Link>
            </nav>
          </div>
          <CommunityArt />
        </section>
      </Revealed>

      {/* 2-3 Next Actions Triage Strip */}
      <Revealed delay={80}>
        <div className="brief-actions-container">
          <div className="brief-actions-header">
            <h3>Prioritized Next Actions</h3>
            <span className="brief-actions-badge">Today’s triage</span>
          </div>

          <div className="brief-actions-grid">
            {/* Action 1: Expenses */}
            <article className="brief-action-card action-amber">
              <div className="brief-action-top">
                <span className="action-tag amber">Finance Review</span>
                <span className="action-count">{pending.length} pending</span>
              </div>
              <h4>{pending.length} expense requests awaiting approval</h4>
              <p>Reimbursements and vendor receipts submitted for recent workshop inventory.</p>
              <div className="brief-action-cta">
                <Link to="/app/finance" className="action-button-link">
                  Review in Ledger <Icon name="ArrowRight" size={15} />
                </Link>
              </div>
            </article>

            {/* Action 2: Members */}
            <article className="brief-action-card action-purple">
              <div className="brief-action-top">
                <span className="action-tag purple">Membership Roster</span>
                <span className="action-count">{pendingMembers} pending</span>
              </div>
              <h4>{pendingMembers} new memberships ready to welcome</h4>
              <p>Pending registrations awaiting confirmation and dues verification.</p>
              <div className="brief-action-cta">
                <Link to="/app/members?status=Pending" className="action-button-link">
                  Review Roster <Icon name="ArrowRight" size={15} />
                </Link>
              </div>
            </article>

            {/* Action 3: Marquee Event */}
            <article className="brief-action-card action-emerald">
              <div className="brief-action-top">
                <span className="action-tag emerald">Marquee Gathering</span>
                <span className="action-count">
                  {upcoming[0]?.sold || 0}/{upcoming[0]?.capacity || 0} booked
                </span>
              </div>
              <h4>{upcoming[0]?.title || 'Next Campus Gathering'}</h4>
              <p>
                {upcoming[0]?.time || 'Upcoming'} at {upcoming[0]?.venue?.split(',')[0] || 'Campus Hall'}
              </p>
              <div className="brief-action-cta">
                <Link to={upcoming[0] ? `/app/events/${upcoming[0].id}` : '/app/events'} className="action-button-link">
                  Manage Event <Icon name="ArrowRight" size={15} />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </Revealed>

      {/* Balanced 2-Column: Finance Clarity & Campus Activity */}
      <Revealed delay={160}>
        <div className="brief-stream-grid">
          {/* Finance Overview */}
          <section className="card finance-overview dark-card brief-finance-card">
            <CardHeader
              title="Every rupee, accounted for"
              subtitle="A little clarity for your club’s finances."
              action={
                <select
                  aria-label="Finance chart period"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="semester">This semester</option>
                  <option value="month">This month</option>
                </select>
              }
            />
            <div className="chart-summary">
              <span>
                <small>Total income</small>
                <strong>
                  {money(
                    completed
                      .filter(
                        (t) => t.amount > 0 && (range === 'semester' || t.date.startsWith('2026-10')),
                      )
                      .reduce((s, t) => s + t.amount, 0),
                  )}
                </strong>
              </span>
              <span className="chart-legend">
                <span>
                  <i className="legend-dot white" />
                  Income
                </span>
                <span>
                  <i className="legend-dot mint" />
                  Expenses
                </span>
              </span>
            </div>
            <FinanceChart values={chartValues} />
            <Link to="/app/finance" className="dark-card-footer">
              See the full picture <Icon name="ArrowUpRight" size={16} />
            </Link>
          </section>

          {/* Right Column: Upcoming & Announcement Stream */}
          <div className="brief-sidebar-stack">
            {/* Latest Announcement */}
            <section className="card activity-card brief-activity-card">
              <CardHeader
                title="The latest around Skyline"
                action={
                  <Link to="/app/announcements" className="text-link">
                    All updates <Icon name="ArrowRight" size={14} />
                  </Link>
                }
              />
              <div className="activity-row">
                <Avatar name={data.announcements[0]?.author || 'Skyline Team'} index={2} />
                <div>
                  <strong>{data.announcements[0]?.title || 'Welcome to your workspace'}</strong>
                  <p>{data.announcements[0]?.body.slice(0, 110)}…</p>
                </div>
                <span className="activity-date">
                  {date(data.announcements[0]?.date || '2026-10-10', { day: 'numeric', month: 'short' })}
                </span>
                <Link to="/app/announcements" className="plain-icon" aria-label="Read announcement">
                  <Icon name="ArrowUpRight" size={20} />
                </Link>
              </div>
            </section>

            {/* Upcoming Events Agenda */}
            <section className="card upcoming-card brief-upcoming-card">
              <CardHeader
                title="See you there"
                subtitle="Upcoming dates on the schedule."
                action={
                  <Link to="/app/calendar" className="plain-icon" aria-label="View calendar">
                    <Icon name="ArrowUpRight" size={19} />
                  </Link>
                }
              />
              {upcoming.map((e) => (
                <Link to={`/app/events/${e.id}`} key={e.id} className="upcoming-item">
                  <div
                    className={`date-tile ${e.category === 'Fundraiser' ? 'green' : e.category === 'Social' ? 'purple' : 'gold'}`}
                  >
                    <small>{date(e.date, { month: 'short' }).toUpperCase()}</small>
                    <strong>{new Date(e.date + 'T12:00:00').getDate()}</strong>
                  </div>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {e.time} · {e.venue.split(',')[0]}
                    </small>
                  </span>
                  <Icon name="ArrowUpRight" size={17} />
                </Link>
              ))}
              <Link to="/app/calendar" className="text-link upcoming-footer">
                Open campus calendar
                <Icon name="ArrowRight" size={15} />
              </Link>
            </section>
          </div>
        </div>
      </Revealed>
    </>
  );
}
