import { useState } from 'react';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, exportCSV } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { cloudMode } from '../../../shared/api/client';
import '../../../app/layout/workspace.css';

const actionLabels: Record<string, string> = {
  'membership.join': 'Joined club',
  'membership.demo-dues': 'Paid membership dues',
  'users.update': 'Updated user',
  'users.remove': 'Removed user',
  'users.add': 'Added user',
  'orders.place': 'Placed order',
  'promos.save': 'Saved promo',
  'points.award': 'Awarded points',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

export function AuditPage() {
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const entries = data.audit.filter((a) => {
    const label = actionLabels[a.action] || a.action;
    return `${a.actor} ${a.detail} ${a.action} ${label}`.toLowerCase().includes(query.toLowerCase());
  });
  return (
    <>
      <PageHeader
        eyebrow="CLUB RECORD"
        title="Activity & audit"
        description="Search who joined, updated users, or changed club data — then export the log."
        action={
          <Button
            variant="secondary"
            icon="Download"
            onClick={() =>
              exportCSV('skyline-audit.csv', [
                ['Time', 'Actor', 'Action', 'Entity', 'Reference', 'Details'],
                ...entries.map((a) => [
                  a.date,
                  a.actor,
                  actionLabels[a.action] || a.action,
                  a.entity,
                  a.entityId,
                  a.detail,
                ]),
              ])
            }
          >
            Export CSV
          </Button>
        }
      />
      <div className="info-banner audit-note">
        <Icon name="ShieldCheck" />
        <p>
          {cloudMode
            ? 'Includes student joins (membership.join), user updates, orders, and finance reviews.'
            : 'Local demo records club changes in this browser. Search “joined” to find membership joins.'}
        </p>
      </div>
      <section className="card table-card">
        <div className="table-toolbar">
          <h2>{entries.length} actions</h2>
          <input
            className="audit-search"
            placeholder="Search joined, updated, actor…"
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
                      {actionLabels[a.action] || a.action}
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
