import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import { exportCSV } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { cloudMode } from '../../../shared/api/client';
import '../../../app/layout/workspace.css';

const PAGE_SIZE = 10;

export const actionLabels: Record<string, string> = {
  'membership.join': 'Joined club',
  'membership.demo-dues': 'Paid membership dues',
  'users.update': 'Updated user',
  'users.remove': 'Removed user',
  'users.add': 'Added user',
  'orders.place': 'Placed order',
  'orders.update': 'Updated order',
  'promos.save': 'Saved promo',
  'points.award': 'Awarded points',
  'points.rules': 'Updated point rules',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

const rangeMs: Record<string, number | null> = {
  All: null,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function AuditPage() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [action, setAction] = useState('All');
  const [entity, setEntity] = useState('All');
  const [range, setRange] = useState('All');
  const [page, setPage] = useState(1);
  const urlQuery = params.get('q') || '';
  useEffect(() => {
    setQuery(urlQuery);
    setPage(1);
  }, [urlQuery]);

  const actionOptions = useMemo(() => {
    const unique = [...new Set(data.audit.map((a) => a.action))].sort();
    return unique;
  }, [data.audit]);

  const entityOptions = useMemo(() => {
    const unique = [...new Set(data.audit.map((a) => a.entity).filter(Boolean))].sort();
    return unique;
  }, [data.audit]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = rangeMs[range];
    const now = Date.now();
    return [...data.audit]
      .filter((a) => {
        const label = actionLabels[a.action] || a.action;
        const hay = `${a.actor} ${a.detail} ${a.action} ${label} ${a.entity} ${a.entityId}`.toLowerCase();
        if (needle && !hay.includes(needle)) return false;
        if (action !== 'All' && a.action !== action) return false;
        if (entity !== 'All' && a.entity !== entity) return false;
        if (cutoff != null) {
          const t = new Date(a.date).getTime();
          if (Number.isNaN(t) || now - t > cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.audit, query, action, entity, range]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

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
                ...filtered.map((a) => [
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
        <div className="table-toolbar audit-toolbar">
          <div className="audit-filters">
            <SearchField
              value={query}
              placeholder="Search actor, action, entity, details…"
              onChange={(value) => {
                setQuery(value);
                resetPage();
                const next = new URLSearchParams(params);
                if (value.trim()) next.set('q', value.trim());
                else next.delete('q');
                setParams(next, { replace: true });
              }}
            />
            <label className="audit-filter">
              <span>Action</span>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  resetPage();
                }}
              >
                <option value="All">All actions</option>
                {actionOptions.map((value) => (
                  <option key={value} value={value}>
                    {actionLabels[value] || value}
                  </option>
                ))}
              </select>
            </label>
            <label className="audit-filter">
              <span>Entity</span>
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  resetPage();
                }}
              >
                <option value="All">All entities</option>
                {entityOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="group" aria-label="Time range">
              {[
                ['All', 'All time'],
                ['24h', '24h'],
                ['7d', '7 days'],
                ['30d', '30 days'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={range === value ? 'selected' : ''}
                  onClick={() => {
                    setRange(value);
                    resetPage();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <h2>{filtered.length} actions</h2>
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
              {visible.map((a) => (
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
        {!filtered.length && (
          <Empty
            title={query || action !== 'All' || entity !== 'All' || range !== 'All' ? 'No matching activity' : 'The next action starts the story'}
            description={
              query || action !== 'All' || entity !== 'All' || range !== 'All'
                ? 'Try another search term or clear the filters.'
                : 'Create a record or review an expense to see the audit trail.'
            }
          />
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} actions
          </span>
          <div className="pagination">
            <button
              className="icon-button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span>
              {currentPage} / {pages}
            </span>
            <button
              className="icon-button"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
