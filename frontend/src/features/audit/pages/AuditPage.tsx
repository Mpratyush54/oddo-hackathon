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

export function AuditPage() {
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
          {cloudMode
            ? 'Business changes are recorded in the shared club audit history.'
            : 'This local demo records business changes automatically in editable browser storage.'}
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
