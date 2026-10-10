import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatCard } from '../../../shared/ui/StatCard';
import { date, money, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { cloudMode } from '../../../shared/api/client';
import { CloudCollege } from './CollegeOverview';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { accentColor } from '../../../shared/utils/color';

export function CollegeDashboard() {
  return cloudMode ? <CloudCollege /> : <DemoCollegeDashboard />;
}

export function DemoCollegeDashboard() {
  const { allClubs, organizations } = useStore();
  const unique = new Set(
    Object.values(allClubs).flatMap((d) => d.members.map((m) => m.email.toLowerCase())),
  );
  const events = Object.values(allClubs)
    .flatMap((d) => d.events)
    .filter((e) => e.date >= today);
  const balance = Object.values(allClubs)
    .flatMap((d) => d.transactions)
    .filter((t) => t.status === 'Completed')
    .reduce((n, t) => n + t.amount, 0);
  const { selectClub } = useSession();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="SKYLINE COLLEGE · CAMPUS OVERVIEW"
        title="A campus full of possibility."
        description="See how independent student communities contribute to one connected campus."
      />
      <div className="portal-stat-grid">
        <StatCard icon="UsersRound" label="Student organizations" value={organizations.length} />
        <StatCard
          icon="UserCheck"
          label="Unique participants"
          value={unique.size}
          note="Deduplicated by student email"
        />
        <StatCard
          icon="CalendarDays"
          label="Upcoming campus events"
          value={events.length}
          tone="gold"
        />
        <StatCard
          icon="Wallet"
          label="Combined club balance"
          value={money(balance)}
          tone="purple"
        />
      </div>
      <section className="portal-panel">
        <CardHeader
          title="The campus community"
          subtitle="Aggregate club summaries. Select an organization to inspect its workspace."
        />
        <div className="discovery-crosslink">
          <LinkButton to="/events" icon="CalendarDays" variant="secondary">
            See all campus events
          </LinkButton>
        </div>
        <div className="portal-club-grid">
          {organizations.map((c) => {
            const d = allClubs[c.id];
            return (
              <article className="portal-club" key={c.id}>
                <span className="portal-club-symbol" style={{ background: accentColor(c.accent) }}>
                  {c.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <h2>{c.name}</h2>
                <p>{c.description}</p>
                <div className="portal-club-metrics">
                  <span>
                    <strong>{d?.members.length || 0}</strong> memberships
                  </span>
                  <span>
                    <strong>{d?.events.length || 0}</strong> events
                  </span>
                </div>
                <Button
                  variant="secondary"
                  icon="ArrowUpRight"
                  onClick={() => {
                    selectClub(c.id);
                    navigate('/app/club-summary');
                  }}
                >
                  View club
                </Button>
              </article>
            );
          })}
        </div>
      </section>
      <div className="portal-note portal-latest">
        <Icon name="ShieldCheck" />
        <p>
          This college view shows aggregate participation and club balances. Individual receipts
          belong in the authorized club finance workspace.
        </p>
      </div>
    </>
  );
}
