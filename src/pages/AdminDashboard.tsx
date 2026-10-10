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
  const upcoming = [...data.events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const done = data.tasks.filter((t) => t.status === 'Done').length;
  const modules = [
    {
      icon: 'UsersRound',
      label: 'Your community',
      value: data.members.length.toString().padStart(2, '0'),
      meta: `${paid} active memberships`,
      progress: (paid / data.members.length) * 100,
      caption: 'Dues collected',
      to: '/app/members',
      action: 'Manage members',
      tone: 'teal',
      badge: 'Members',
    },
    {
      icon: 'CalendarDays',
      label: 'Good times ahead',
      value: data.events.length.toString().padStart(2, '0'),
      meta: 'Events this semester',
      progress:
        (data.events.reduce((s, e) => s + e.sold, 0) /
          data.events.reduce((s, e) => s + e.capacity, 0)) *
        100,
      caption: 'Tickets reserved',
      to: '/app/events',
      action: 'Explore events',
      tone: 'purple',
      badge: 'Events',
    },
    {
      icon: 'ShoppingBag',
      label: 'Wear your Skyline',
      value: `${data.orders.length.toString().padStart(2, '0')}`,
      meta: 'Orders in your store',
      progress:
        (100 *
          data.products.reduce(
            (s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0),
            0,
          )) /
        (data.products.reduce((s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0), 0) +
          data.orders.length),
      caption: 'Inventory available',
      to: '/app/merchandise',
      action: 'Visit the store',
      tone: 'gold',
      badge: 'Merchandise',
    },
    {
      icon: 'ListTodo',
      label: 'Make things happen',
      value: data.tasks.length.toString().padStart(2, '0'),
      meta: `${done} tasks completed`,
      progress: (done / Math.max(data.tasks.length, 1)) * 100,
      caption: 'Project progress',
      to: '/app/tasks',
      action: 'View project board',
      tone: 'green',
      badge: 'Projects',
    },
  ];
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
      <Revealed>
        <div className="dashboard-top">
          <section className="welcome-card">
            <div className="welcome-content">
              <div className="hero-eyebrow">
                <span className="tiny-sun">✷</span> SATURDAY, OCTOBER 10
              </div>
              <h2>
                Welcome back, {user.name.split(' ')[0]} <span className="wave">✦</span>
              </h2>
              <p>Small steps. Big impact. Let’s make this semester count.</p>
              <div className="hero-stats">
                <div>
                  <span className="hero-icon">
                    <Icon name="Wallet" size={23} />
                  </span>
                  <span>
                    <small>Club balance</small>
                    <strong>{money(total)}</strong>
                  </span>
                </div>
                <span className="hero-stat-divider" />
                <div>
                  <span className="hero-icon">
                    <Icon name="UsersRound" size={23} />
                  </span>
                  <span>
                    <small>A growing community</small>
                    <strong>
                      {data.members.length}
                      <em> members</em>
                    </strong>
                  </span>
                </div>
              </div>
              <div className="hero-bottom">
                <span className="hero-live-dot" />
                Your community is in a good place.
              </div>
            </div>
            <CommunityArt />
          </section>
          <section className="card membership-card">
            <CardHeader
              title="A connected community"
              action={
                <Link to="/app/members" className="plain-icon" aria-label="View membership details">
                  <Icon name="ArrowUpRight" size={19} />
                </Link>
              }
            />
            <div className="ring-content">
              <div
                className="donut"
                style={
                  {
                    '--percentage': `${(paid / Math.max(data.members.length, 1)) * 100}%`,
                  } as React.CSSProperties
                }
              >
                <span>
                  <strong>
                    {Math.round((paid / Math.max(data.members.length, 1)) * 100)}
                    <small>%</small>
                  </strong>
                  <small>Dues collected</small>
                </span>
              </div>
              <div className="ring-legend">
                <div>
                  <span className="legend-dot teal" />
                  <span>Paid members</span>
                  <strong>{paid}</strong>
                </div>
                <div>
                  <span className="legend-dot gold" />
                  <span>Awaiting dues</span>
                  <strong>{data.members.length - paid}</strong>
                </div>
                <Link to="/app/members?status=Pending" className="text-link">
                  Give them a nudge <Icon name="ArrowRight" size={14} />
                </Link>
              </div>
            </div>
            <div className="membership-footer">
              <Icon name="Sparkles" size={15} />
              <span>More than a club. A community.</span>
            </div>
          </section>
        </div>
      </Revealed>
      <Revealed delay={90}>
        <div className="module-grid">
          {modules.map((m) => (
            <section key={m.to} className={`module-card ${m.tone}`}>
              <div className="module-top">
                <span className={`icon-tile ${m.tone}`}>
                  <Icon name={m.icon} size={22} />
                </span>
                <Badge tone={m.tone}>{m.badge}</Badge>
              </div>
              <div className="module-label">{m.label}</div>
              <div className="module-number">
                {m.value}
                <span>{m.meta}</span>
              </div>
              <div className="progress-caption">
                <span>{m.caption}</span>
                <strong>{Math.round(m.progress)}%</strong>
              </div>
              <Progress value={m.progress} tone={m.tone} />
              <Link to={m.to} className={`module-link ${m.tone}`}>
                {m.action}
                <Icon name="ArrowRight" size={16} />
              </Link>
            </section>
          ))}
        </div>
      </Revealed>
      <Revealed delay={180}>
        <div className="dashboard-lower">
          <section className="card finance-overview dark-card">
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
          <section className="card attention-card">
            <CardHeader title="A little attention" subtitle="Small things to keep us on track." />
            <Link className="attention-item" to="/app/finance">
              <span className="icon-tile gold">
                <Icon name="Receipt" size={20} />
              </span>
              <span>
                <strong>{pending.length} expense requests</strong>
                <small>Ready for your review</small>
              </span>
              <Icon name="ChevronRight" size={17} />
            </Link>
            <Link className="attention-item" to="/app/members?status=Pending">
              <span className="icon-tile purple">
                <Icon name="UserRoundPlus" size={20} />
              </span>
              <span>
                <strong>
                  {data.members.filter((m) => m.status === 'Pending').length} pending memberships
                </strong>
                <small>A warm welcome awaits</small>
              </span>
              <Icon name="ChevronRight" size={17} />
            </Link>
            <Link className="attention-item" to="/app/tasks">
              <span className="icon-tile green">
                <Icon name="Flag" size={20} />
              </span>
              <span>
                <strong>Bake sale is coming up</strong>
                <small>{data.tasks.length - done} tasks still to go</small>
              </span>
              <Icon name="ChevronRight" size={17} />
            </Link>
            <div className="attention-note">
              <Icon name="Coffee" size={18} />
              <p>
                You’ve got this.
                <br />
                <strong>One thing at a time.</strong>
              </p>
            </div>
          </section>
          <section className="card upcoming-card">
            <CardHeader
              title="See you there"
              subtitle="Good company. Great plans."
              action={
                <Link to="/app/events" className="plain-icon" aria-label="View all events">
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
              Open calendar
              <Icon name="ArrowRight" size={15} />
            </Link>
          </section>
        </div>
      </Revealed>
      <Revealed delay={250}>
        <section className="card activity-card">
          <CardHeader
            title="The latest around Skyline"
            action={
              <Link to="/app/announcements" className="text-link">
                All announcements <Icon name="ArrowRight" size={15} />
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
      </Revealed>
    </>
  );
}
