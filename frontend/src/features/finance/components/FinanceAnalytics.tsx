import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FinanceChart } from '../../../shared/ui/FinanceChart';
import { Icon } from '../../../shared/ui/Icon';
import { Progress } from '../../../shared/ui/Progress';
import { date, money } from '../../../shared/utils/format';
import type { ClubEvent, Store, Transaction } from '../../../shared/types/domain';

function completed(rows: Transaction[]) {
  return rows.filter((t) => t.status === 'Completed');
}

function sumIn(rows: Transaction[]) {
  return completed(rows)
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
}

function sumOut(rows: Transaction[]) {
  return -completed(rows)
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
}

function eventStats(data: Store, event: ClubEvent) {
  const linked = data.transactions.filter((t) => t.eventId === event.id);
  const tickets = data.tickets.filter((t) => t.eventId === event.id && t.status !== 'Cancelled');
  const checkedIn = tickets.filter((t) => t.checkedIn).length;
  const ticketRevenue = tickets.reduce((s, t) => s + (t.amount || 0), 0);
  const income = sumIn(linked);
  const spend = sumOut(linked);
  const pending = -linked
    .filter((t) => t.status === 'Pending' && t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
  const budget = event.budget || 0;
  return {
    linked,
    tickets,
    checkedIn,
    ticketRevenue,
    income,
    spend,
    pending,
    budget,
    net: income - spend,
    fill: event.capacity ? Math.round((event.sold / event.capacity) * 100) : 0,
    checkInRate: tickets.length ? Math.round((checkedIn / tickets.length) * 100) : 0,
    budgetUsed: budget ? Math.round((spend / budget) * 100) : 0,
  };
}

export function FinanceAnalytics({
  data,
  periodRows,
  period,
}: {
  data: Store;
  periodRows: Transaction[];
  period: string;
}) {
  const [mode, setMode] = useState<'overall' | 'event'>('overall');
  const [eventId, setEventId] = useState(data.events[0]?.id || '');
  const approved = completed(periodRows);

  const byCategory = useMemo(() => {
    const labels = ['Membership', 'Tickets', 'Merchandise', 'Fundraiser', 'Expenses'] as const;
    return labels.map((name) => {
      const rows = approved.filter((t) => t.category === name);
      const amount =
        name === 'Expenses'
          ? -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
          : rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return { name, amount };
    });
  }, [approved]);

  const months = useMemo(() => {
    const labels = [
      ['Aug', '08'],
      ['Sep', '09'],
      ['Oct', '10'],
    ] as const;
    return labels
      .map(([label, mm]) => {
        const rows = approved.filter((t) => t.date.slice(5, 7) === mm);
        return {
          label,
          income: rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
          expense: -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
        };
      })
      .filter((m) => period !== 'month' || m.label === 'Oct');
  }, [approved, period]);

  const maxCategory = Math.max(...byCategory.map((c) => c.amount), 1);
  const selected = data.events.find((e) => e.id === eventId) || data.events[0];
  const stats = selected ? eventStats(data, selected) : null;
  const eventLeaderboard = useMemo(
    () =>
      [...data.events]
        .map((event) => {
          const s = eventStats(data, event);
          return { event, ...s };
        })
        .sort((a, b) => b.net - a.net || b.ticketRevenue - a.ticketRevenue),
    [data],
  );

  return (
    <section className="card finance-analytics">
      <div className="finance-analytics-toolbar">
        <div>
          <h2>Analytics</h2>
          <p>Overall club performance and per-event results for treasurer & president.</p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={mode === 'overall' ? 'selected' : ''}
            onClick={() => setMode('overall')}
          >
            Overall
          </button>
          <button
            type="button"
            className={mode === 'event' ? 'selected' : ''}
            onClick={() => setMode('event')}
          >
            By event
          </button>
        </div>
      </div>

      {mode === 'overall' ? (
        <div className="finance-analytics-grid">
          <div className="finance-analytics-panel">
            <h3>Money flow</h3>
            <div className="light-chart-legend">
              <span>
                <i className="legend-dot teal" />
                Money in
              </span>
              <span>
                <i className="legend-dot gold" />
                Money out
              </span>
            </div>
            <FinanceChart values={months} dark={false} />
          </div>
          <div className="finance-analytics-panel">
            <h3>By category</h3>
            <div className="finance-category-bars">
              {byCategory.map((c) => (
                <div key={c.name}>
                  <div>
                    <span>{c.name}</span>
                    <strong>{money(c.amount)}</strong>
                  </div>
                  <div className="finance-bar-track">
                    <span style={{ width: `${(c.amount / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="finance-analytics-panel finance-analytics-wide">
            <h3>Event snapshot</h3>
            {eventLeaderboard.length ? (
              <div className="table-scroll">
                <table className="finance-event-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Tickets</th>
                      <th>Fill</th>
                      <th>Ticket sales</th>
                      <th>Ledger net</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {eventLeaderboard.map(({ event, tickets, fill, ticketRevenue, net }) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.title}</strong>
                        </td>
                        <td>{date(event.date, { day: 'numeric', month: 'short' })}</td>
                        <td>
                          {event.sold}/{event.capacity}
                          <small className="cell-subtext">{tickets.length} confirmed</small>
                        </td>
                        <td>{fill}%</td>
                        <td className="amount-in">{money(ticketRevenue)}</td>
                        <td className={net >= 0 ? 'amount-in' : 'amount-out'}>{money(net)}</td>
                        <td>
                          <button
                            type="button"
                            className="plain-link"
                            onClick={() => {
                              setEventId(event.id);
                              setMode('event');
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No events yet to analyse.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="finance-event-analytics">
          <label className="finance-event-picker">
            <span>Event</span>
            <select
              aria-label="Event for analytics"
              value={selected?.id || ''}
              onChange={(e) => setEventId(e.target.value)}
            >
              {data.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {date(e.date, { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          </label>

          {!selected || !stats ? (
            <p className="muted">Create an event to see event-specific analytics.</p>
          ) : (
            <>
              <div className="finance-event-stat-grid">
                <div>
                  <small>Ticket sales</small>
                  <strong className="amount-in">{money(stats.ticketRevenue)}</strong>
                </div>
                <div>
                  <small>Ledger income</small>
                  <strong className="amount-in">{money(stats.income)}</strong>
                </div>
                <div>
                  <small>Actual spend</small>
                  <strong className="amount-out">{money(stats.spend)}</strong>
                </div>
                <div>
                  <small>Net result</small>
                  <strong className={stats.net >= 0 ? 'amount-in' : 'amount-out'}>
                    {money(stats.net)}
                  </strong>
                </div>
                <div>
                  <small>Budget</small>
                  <strong>{money(stats.budget)}</strong>
                </div>
                <div>
                  <small>Pending commitments</small>
                  <strong>{money(stats.pending)}</strong>
                </div>
              </div>

              <div className="finance-event-meters">
                <div>
                  <div className="finance-meter-label">
                    <span>
                      <Icon name="Ticket" size={16} /> Capacity fill
                    </span>
                    <strong>
                      {selected.sold}/{selected.capacity} · {stats.fill}%
                    </strong>
                  </div>
                  <Progress value={stats.fill} tone="purple" />
                </div>
                <div>
                  <div className="finance-meter-label">
                    <span>
                      <Icon name="UserCheck" size={16} /> Check-in rate
                    </span>
                    <strong>
                      {stats.checkedIn}/{stats.tickets.length} · {stats.checkInRate}%
                    </strong>
                  </div>
                  <Progress value={stats.checkInRate} tone="teal" />
                </div>
                <div>
                  <div className="finance-meter-label">
                    <span>
                      <Icon name="Wallet" size={16} /> Budget used
                    </span>
                    <strong>
                      {money(stats.spend)} of {money(stats.budget)} · {stats.budgetUsed}%
                    </strong>
                  </div>
                  <Progress
                    value={Math.min(stats.budgetUsed, 100)}
                    tone={stats.spend > stats.budget ? 'gold' : 'green'}
                  />
                </div>
              </div>

              <div className="finance-event-linked">
                <h3>Linked ledger entries ({stats.linked.length})</h3>
                {stats.linked.length ? (
                  <ul>
                    {stats.linked.slice(0, 8).map((t) => (
                      <li key={t.id}>
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {t.status} · {date(t.date)}
                          </small>
                        </span>
                        <strong className={t.amount < 0 ? 'amount-out' : 'amount-in'}>
                          {t.amount > 0 ? '+' : '−'}
                          {money(Math.abs(t.amount))}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    No ledger rows linked yet. Choose this event when recording income or expenses.
                  </p>
                )}
                <Link className="button secondary" to={`/app/events/${selected.id}`}>
                  Open event page
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
