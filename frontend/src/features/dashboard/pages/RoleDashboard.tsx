import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Progress } from '../../../shared/ui/Progress';
import { date, money, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';
import { MemberPreview } from '../../membership/components/MemberPreview';
import { EventList } from '../../events/components/EventList';
import { CollegeDashboard } from '../../college/pages/CollegeDashboard';

export function RoleDashboard() {
  const { role, user } = useSession();
  const { data } = useStore();
  const personal = usePersonal();
  const membershipActive = personal.member?.status === 'Active' && personal.member.expires >= today;
  if (role === 'college') return <CollegeDashboard />;
  const completed = data.transactions.filter((t) => t.status === 'Completed');
  const balance = completed.reduce((n, t) => n + t.amount, 0);
  const pending = data.transactions.filter((t) => t.status === 'Pending');
  if (role === 'treasurer')
    return (
      <div className="role-stage treasurer-stage">
        <header className="treasurer-hero dark-hero-card">
          <div className="treasurer-hero-main">
            <span className="role-kicker">
              <Icon name="Wallet" size={16} /> TREASURER DESK & APPROVAL STAGE
            </span>
            <h1>Good morning, {user.name.split(' ')[0]}.</h1>
            <p>Every rupee accounted for. Keep club spending clean and transparent.</p>
            <div className="treasurer-hero-actions">
              <LinkButton to="/app/finance" icon="ArrowUpRight">
                Open Ledger
              </LinkButton>
              <LinkButton to="/app/finance?action=request" variant="secondary" icon="Plus">
                Record Reimbursement
              </LinkButton>
            </div>
          </div>
          <div className="treasurer-hero-badge-card">
            <span className="treasurer-badge-label">Available Balance</span>
            <strong className="treasurer-badge-amount">{money(balance)}</strong>
            <div className="treasurer-balance-split">
              <div>
                <small>Income</small>
                <span>
                  +{money(completed.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0))}
                </span>
              </div>
              <div>
                <small>Expenses</small>
                <span>
                  -
                  {money(
                    Math.abs(
                      completed.filter((t) => t.amount < 0).reduce((n, t) => n + t.amount, 0),
                    ),
                  )}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-columns" style={{ marginTop: '24px' }}>
          <section className="portal-panel approval-stage-panel">
            <CardHeader
              title={`Approval Queue (${pending.length})`}
              subtitle="Pending expenses awaiting treasurer approval."
              action={
                <Link to="/app/finance" className="text-link">
                  Open full ledger →
                </Link>
              }
            />
            {pending.map((t) => (
              <div className="approval-stage-row" key={t.id}>
                <span className="icon-tile gold">
                  <Icon name="Receipt" />
                </span>
                <div className="approval-stage-info">
                  <strong>{t.title}</strong>
                  <small>
                    {t.receipt ? `Receipt: ${t.receipt}` : 'Receipt required'} · {date(t.date)}
                  </small>
                </div>
                <div className="approval-stage-action">
                  <strong>{money(Math.abs(t.amount))}</strong>
                  <Link to="/app/finance" className="button secondary small-btn">
                    Review
                  </Link>
                </div>
              </div>
            ))}
            {!pending.length && (
              <Empty
                title="Ledger is clean"
                description="There are no pending expenses to review."
              />
            )}
          </section>

          <section className="portal-panel">
            <CardHeader title="Finance in context" subtitle="Follow activity behind the ledger." />
            <div className="treasurer-context-cards">
              <Link className="portal-action-card" to="/app/events">
                <Icon name="Ticket" />
                <div>
                  <h3>Event revenue & bookings</h3>
                  <p>Compare capacity, ticket revenue, and budget caps.</p>
                </div>
                <Icon name="ArrowUpRight" />
              </Link>
              <Link className="portal-action-card" to="/app/merchandise">
                <Icon name="ShoppingBag" />
                <div>
                  <h3>Merch inventory & orders</h3>
                  <p>Check sales and cash flow before next inventory run.</p>
                </div>
                <Icon name="ArrowUpRight" />
              </Link>
            </div>
            <div className="portal-note" style={{ marginTop: '16px' }}>
              <Icon name="ShieldCheck" size={18} />
              <p>All transactions are mirrored on campus ledger with immutable audit logs.</p>
            </div>
          </section>
        </div>
      </div>
    );

  if (role === 'organizer')
    return (
      <div className="role-stage organizer-stage">
        <header className="organizer-door-hero dark-hero-card">
          <div className="organizer-hero-info">
            <span className="role-kicker">
              <Icon name="ScanLine" size={16} /> ORGANIZER DOOR BOARD & DISPATCH
            </span>
            <h1>Let's make it happen, {user.name.split(' ')[0]}.</h1>
            <p>Live attendance readiness, guests arriving, and team assignments for tonight.</p>
            <div className="organizer-hero-actions">
              <LinkButton to="/app/check-in" icon="ScanLine">
                Launch QR Door Station
              </LinkButton>
              <LinkButton to="/app/events/manage?create=true" variant="secondary" icon="Plus">
                Create Event
              </LinkButton>
            </div>
          </div>
          <div className="organizer-door-meter">
            <div className="door-meter-circle">
              <Icon name="Users" size={28} />
              <strong>
                {data.tickets.filter((t) => t.checkedIn).length} / {data.tickets.length}
              </strong>
              <small>Checked in at door</small>
            </div>
            <div className="door-meter-stats">
              <div>
                <strong>{data.events.filter((e) => e.date >= today).length}</strong>
                <span>Active events</span>
              </div>
              <div>
                <strong>{data.tasks.filter((t) => t.status !== 'Done').length}</strong>
                <span>Open tasks</span>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-columns" style={{ marginTop: '24px' }}>
          <section className="portal-panel">
            <CardHeader
              title="Door & Event Readiness"
              subtitle="Live event capacity & attendee count."
              action={
                <Link className="text-link" to="/app/events">
                  All events →
                </Link>
              }
            />
            {data.events.map((e) => (
              <Link className="portal-readiness" key={e.id} to={`/app/events/${e.id}`}>
                <div>
                  <h3>{e.title}</h3>
                  <small>
                    {date(e.date)} · {e.venue}
                  </small>
                </div>
                <div>
                  <Badge tone={e.sold >= e.capacity ? 'gold' : 'teal'}>
                    {e.sold >= e.capacity ? 'Full' : `${e.capacity - e.sold} spaces left`}
                  </Badge>
                  <Progress value={(e.sold / e.capacity) * 100} />
                  <small>
                    {e.sold} / {e.capacity} booked
                  </small>
                </div>
              </Link>
            ))}
          </section>

          <section className="portal-panel">
            <CardHeader
              title="Dispatch & Team Tasks"
              subtitle="High priority checklist"
              action={
                <Link to="/app/tasks" className="text-link">
                  Open board →
                </Link>
              }
            />
            {data.tasks
              .filter((t) => t.status !== 'Done')
              .slice(0, 4)
              .map((t) => (
                <Link className="portal-row" to="/app/tasks" key={t.id}>
                  <Avatar name={t.assignee} small />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.assignee} · due {date(t.due)}
                    </small>
                  </div>
                  <Badge
                    tone={t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'gold' : 'teal'}
                  >
                    {t.priority}
                  </Badge>
                </Link>
              ))}
          </section>
        </div>
      </div>
    );

  // Default: Member Pass Vibe landing
  return (
    <div className="role-stage member-stage">
      <section className="member-pass-hero dark-hero-card">
        <div className="member-pass-hero-content">
          <span className="role-kicker">
            <Icon name="BadgeCheck" size={16} /> OFFICIAL CAMPUS PASS
          </span>
          <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
          <p>
            {membershipActive
              ? 'Your pass is active. Explore student workshops, merchandise perks, and campus socials.'
              : personal.member
                ? 'Your enrollment is saved. Membership benefits become available when your dues are recorded.'
                : 'Join this club to receive your campus membership pass.'}
          </p>
          <div className="member-pass-pills">
            <span className="member-pass-pill">
              <Icon name="Ticket" size={15} /> {personal.tickets.length} Booked Events
            </span>
            <span className="member-pass-pill">
              <Icon name="HeartHandshake" size={15} />{' '}
              {personal.tasks.filter((t) => t.status === 'Done').length} Volunteering Done
            </span>
            <span className="member-pass-pill">
              <Icon name="ShoppingBag" size={15} /> {personal.orders.length} Club Orders
            </span>
          </div>
        </div>
        <div className="member-pass-card-widget">
          <MemberPreview />
        </div>
      </section>

      <div className="portal-columns" style={{ marginTop: '24px' }}>
        <section className="portal-panel">
          <CardHeader
            title="Coming up on campus"
            subtitle="Events with member rates"
            action={
              <Link to="/app/events" className="text-link">
                All events →
              </Link>
            }
          />
          <EventList />
        </section>

        <div className="portal-stack">
          <section className="portal-panel">
            <CardHeader
              title="Your assigned tasks"
              subtitle="Current volunteer duties"
              action={
                <Link className="text-link" to="/app/tasks">
                  View board →
                </Link>
              }
            />
            {personal.tasks
              .filter((t) => t.status !== 'Done')
              .slice(0, 3)
              .map((t) => (
                <Link className="portal-row" key={t.id} to="/app/tasks">
                  <Icon name="ListTodo" />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      Due {date(t.due)} · {t.priority} priority
                    </small>
                  </div>
                  <Badge tone={t.status === 'In progress' ? 'gold' : 'teal'}>{t.status}</Badge>
                </Link>
              ))}
            {!personal.tasks.some((t) => t.status !== 'Done') && (
              <p className="portal-muted">
                Nothing assigned right now. You're completely free to enjoy campus!
              </p>
            )}
          </section>

          <section className="portal-panel">
            <CardHeader
              title="Club announcements"
              action={
                <Link to="/app/announcements" className="text-link">
                  Feed →
                </Link>
              }
            />
            {data.announcements.slice(0, 2).map((a) => (
              <Link className="portal-row" to="/app/announcements" key={a.id}>
                <span className="icon-tile">
                  <Icon name="Megaphone" />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.author} · {date(a.date)}
                  </small>
                </div>
                <Icon name="ArrowUpRight" size={16} />
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
