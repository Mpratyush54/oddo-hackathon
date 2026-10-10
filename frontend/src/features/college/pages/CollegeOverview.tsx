import { useEffect, useState } from 'react';
import { backendRequest } from '../../../shared/api/client';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatCard } from '../../../shared/ui/StatCard';
import { money } from '../../../shared/utils/format';

type Overview = {
  uniqueParticipants: number;
  clubs: {
    id: string;
    name: string;
    memberCount: number;
    eventCount: number;
    upcomingCount: number;
    balance: number;
  }[];
};
export function CloudCollege() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void backendRequest<Overview>('/college/overview')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);
  return (
    <>
      <PageHeader
        title="Your campus community"
        description="Shared club summaries and participation."
      />
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          <div className="portal-stat-grid">
            <StatCard icon="UsersRound" label="Student organizations" value={data.clubs.length} />
            <StatCard
              icon="UserCheck"
              label="Unique participants"
              value={data.uniqueParticipants}
            />
            <StatCard
              icon="CalendarDays"
              label="Upcoming campus events"
              value={data.clubs.reduce((n, c) => n + c.upcomingCount, 0)}
            />
            <StatCard
              icon="Wallet"
              label="Combined club balance"
              value={money(data.clubs.reduce((n, c) => n + c.balance, 0))}
            />
          </div>
          <div className="portal-club-grid">
            {data.clubs.map((c) => (
              <section className="portal-panel" key={c.id}>
                <CardHeader title={c.name} />
                <p>
                  {c.memberCount} memberships · {c.eventCount} events
                </p>
                <p>Recorded balance: {money(c.balance)}</p>
              </section>
            ))}
          </div>
        </>
      ) : (
        !error && <p role="status">Loading campus summaries…</p>
      )}
    </>
  );
}
