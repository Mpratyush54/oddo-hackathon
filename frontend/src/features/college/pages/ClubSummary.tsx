import { Badge } from '../../../shared/ui/Badge';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import '../../../app/layout/workspace.css';

export function ClubSummary() {
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
