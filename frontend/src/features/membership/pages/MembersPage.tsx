import { renewingSoon } from '../../../../../shared/reminders.js';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { FormFooter } from '../../../shared/ui/FormFooter';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import { StatCard } from '../../../shared/ui/StatCard';
import { formValues } from '../../../shared/ui/formValues';
import { Revealed } from '../../../shared/components/PageMotion';
import { date, exportCSV, money, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import type { Member } from '../../../shared/types/domain';
import { backendPost, cloudMode } from '../../../shared/api/client';

export function MembersPage() {
  const { data, update, toast, applyServerPatch, selectedClub } = useStore();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || ''),
    [status, setStatus] = useState(params.get('status') || 'All'),
    [sort, setSort] = useState('name'),
    [compact, setCompact] = useState(false),
    [viewMode, setViewMode] = useState<'directory' | 'table'>('directory'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [detail, setDetail] = useState<Member | null>(null);
  const [adding, setAdding] = useState(params.get('create') === 'true');
  const close = useCallback(() => {
    setAdding(false);
    setParams({}, { replace: true });
  }, [setParams]);
  const closeDetail = useCallback(() => setDetail(null), []);
  const filtered = data.members
    .filter(
      (m) =>
        `${m.name} ${m.email} ${m.course}`.toLowerCase().includes(search.toLowerCase()) &&
        (status === 'All' || m.status === status),
    )
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.joined.localeCompare(a.joined),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const activate = (member: Member) => {
    if (cloudMode) {
      toast('Ask the member to pay through Membership, or waive dues in User management.');
      return;
    }
    update((d) => ({
      ...d,
      members: d.members.map((m) =>
        m.id === member.id ? { ...m, status: 'Active', expires: '2027-07-31' } : m,
      ),
      transactions: [
        {
          id: uid('TX'),
          title: `Membership dues · ${member.name}`,
          category: 'Membership',
          amount: 500,
          date: today,
          status: 'Completed',
        },
        ...d.transactions,
      ],
    }));
    toast(`${member.name}'s membership is active. ${money(500)} added to the ledger.`);
    setDetail(null);
  };
  const expiringMembers = data.members.filter((m) => renewingSoon(m, today));
  const sendRenewalReminders = async (targets?: Member[]) => {
    if (cloudMode) {
      try {
        const result = await backendPost<{
          state: import('../../../shared/types/domain').Store;
          prepared: number;
        }>(`/clubs/${encodeURIComponent(selectedClub)}/actions`, {
          type: 'reminders.prepare',
          args: { status: 'Expiring', ...(targets ? { memberIds: targets.map((m) => m.id) } : {}) },
          idempotencyKey: crypto.randomUUID(),
        });
        applyServerPatch(selectedClub, result.state);
        toast(`Queued ${result.prepared} renewal reminders for delivery.`);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Reminder scheduling failed.');
      }
      return;
    }
    const list = targets || expiringMembers;
    if (!list.length) {
      toast('No expiring members found to remind.');
      return;
    }
    const newNotifications = list.map((m) => ({
      id: uid('NOT'),
      title: 'Membership renewal reminder',
      body: `Hi ${m.name}, your membership expires on ${date(m.expires)}. Renew now to keep your club perks!`,
      date: today,
      read: false,
      to: m.email,
      audience: 'Renewing soon',
    }));
    const newDeliveries = list.flatMap((m) => [
      {
        id: uid('DEL'),
        announcementId: 'RENEWAL-REMINDER',
        channel: 'In-app' as const,
        recipient: m.email,
        status: 'Sent' as const,
        date: today,
        detail: `Sent in-app renewal reminder (expires ${m.expires})`,
      },
      {
        id: uid('DEL'),
        announcementId: 'RENEWAL-REMINDER',
        channel: 'Email' as const,
        recipient: m.email,
        status: 'Prepared' as const,
        date: today,
        detail: `Queued outbound renewal email for ${m.email}`,
      },
    ]);
    update((d) => ({
      ...d,
      notifications: [...newNotifications, ...(d.notifications || [])],
      deliveries: [...newDeliveries, ...(d.deliveries || [])],
    }));
    toast(`Sent renewal reminders to ${list.length} expiring member${list.length > 1 ? 's' : ''}.`);
  };
  const exportMembers = () =>
    exportCSV('skyline-members.csv', [
      ['Member ID', 'Name', 'Email', 'Course', 'Status', 'Expires'],
      ...filtered
        .filter((m) => !selected.length || selected.includes(m.id))
        .map((m) => [m.id, m.name, m.email, m.course, m.status, m.expires]),
    ]);
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE MAKE THE DIFFERENCE"
        title="Your community"
        description="A place for everyone. Keep your members connected and cared for."
        action={
          <>
            {expiringMembers.length > 0 && (
              <Button variant="secondary" icon="Bell" onClick={() => sendRenewalReminders()}>
                Send renewal reminders ({expiringMembers.length})
              </Button>
            )}
            <Button variant="secondary" icon="Download" onClick={exportMembers}>
              Export members
            </Button>
            <Button icon="UserRoundPlus" onClick={() => setAdding(true)}>
              Add member
            </Button>
          </>
        }
      />
      <Revealed delay={40}>
        <div className="four-stats">
          <StatCard
            icon="UsersRound"
            label="Total members"
            value={data.members.length}
            note="Growing, one connection at a time"
          />
          <StatCard
            icon="BadgeCheck"
            label="Paid memberships"
            value={data.members.filter((m) => m.status === 'Active').length}
            tone="green"
          />
          <StatCard
            icon="Clock3"
            label="Awaiting dues"
            value={data.members.filter((m) => m.status === 'Pending').length}
            tone="gold"
          />
          <StatCard
            icon="CalendarClock"
            label="Renewing soon"
            value={data.members.filter((m) => m.status === 'Expiring').length}
            tone="purple"
          />
        </div>
      </Revealed>

      <Revealed delay={80}>
        <section className="card table-card members-card-crafted">
          <div className="table-toolbar">
            <div className="segmented">
              {['All', 'Active', 'Pending', 'Expiring'].map((s) => (
                <button
                  key={s}
                  className={status === s ? 'selected' : ''}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="table-tools">
              <SearchField
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Find a member..."
              />
              <div className="segmented member-view-segmented">
                <button
                  className={viewMode === 'directory' ? 'selected' : ''}
                  title="People Directory"
                  onClick={() => setViewMode('directory')}
                >
                  <Icon name="LayoutGrid" size={16} />
                </button>
                <button
                  className={viewMode === 'table' ? 'selected' : ''}
                  title="Roster Table"
                  onClick={() => setViewMode('table')}
                >
                  <Icon name="List" size={16} />
                </button>
              </div>
              {viewMode === 'table' && (
                <button
                  className={`icon-button ${compact ? 'selected' : ''}`}
                  title={compact ? 'Comfortable rows' : 'Compact rows'}
                  aria-label="Toggle table density"
                  onClick={() => setCompact(!compact)}
                >
                  <Icon name="Rows3" size={18} />
                </button>
              )}
            </div>
          </div>
          {selected.length > 0 && (
            <div className="bulk-bar">
              <span>{selected.length} members selected</span>
              {data.members.some((m) => selected.includes(m.id) && m.status === 'Expiring') && (
                <Button
                  variant="white"
                  icon="Bell"
                  onClick={() => {
                    const targets = data.members.filter(
                      (m) => selected.includes(m.id) && m.status === 'Expiring',
                    );
                    sendRenewalReminders(targets);
                  }}
                >
                  Send renewal reminder
                </Button>
              )}
              <Button variant="white" icon="Download" onClick={exportMembers}>
                Export selected
              </Button>
              <button onClick={() => setSelected([])}>Clear selection</button>
            </div>
          )}

          {viewMode === 'directory' ? (
            <div className="member-directory-grid">
              {visible.map((m, i) => (
                <article
                  key={m.id}
                  className="member-card-crafted"
                  onClick={() => setDetail(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setDetail(m);
                  }}
                >
                  <div className="member-card-header">
                    <Avatar name={m.name} index={i} />
                    <Badge
                      tone={
                        m.status === 'Active' ? 'green' : m.status === 'Pending' ? 'gold' : 'purple'
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <div className="member-card-body">
                    <h3>{m.name}</h3>
                    <div className="member-card-pills">
                      <span className="role-tag">{m.role}</span>
                      <span className="course-tag">{m.course}</span>
                    </div>
                    <p className="member-email">{m.email}</p>
                  </div>
                  <div className="member-card-footer">
                    <span className="member-validity">
                      <Icon name="CalendarDays" size={13} />
                      {date(m.expires, { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      className="member-inspect-btn"
                      aria-label={`View ${m.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(m);
                      }}
                    >
                      Profile <Icon name="ArrowUpRight" size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-scroll">
              <table className={compact ? 'compact' : ''}>
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input
                        type="checkbox"
                        aria-label="Select visible members"
                        checked={
                          visible.length > 0 && visible.every((m) => selected.includes(m.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...new Set([...selected, ...visible.map((m) => m.id)])]
                              : selected.filter((id) => !visible.some((m) => m.id === id)),
                          )
                        }
                      />
                    </th>
                    <th>
                      <button
                        className="table-sort"
                        onClick={() => setSort(sort === 'name' ? 'joined' : 'name')}
                      >
                        Member <Icon name="ArrowDownUp" size={12} />
                      </button>
                    </th>
                    <th>Course</th>
                    <th>Membership</th>
                    <th>Valid until</th>
                    <th>Role</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m, i) => (
                    <tr key={m.id} className={selected.includes(m.id) ? 'selected-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${m.name}`}
                          checked={selected.includes(m.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, m.id]
                                : selected.filter((id) => id !== m.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button className="member-cell" onClick={() => setDetail(m)}>
                          <Avatar name={m.name} index={i} />
                          <span>
                            <strong>{m.name}</strong>
                            <small>{m.email}</small>
                          </span>
                        </button>
                      </td>
                      <td>{m.course}</td>
                      <td>
                        <Badge tone={m.status === 'Active' ? 'green' : 'gold'}>{m.status}</Badge>
                      </td>
                      <td>
                        {date(m.expires, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className="role-label">{m.role}</span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`View ${m.name}`}
                          onClick={() => setDetail(m)}
                        >
                          <Icon name="ArrowUpRight" size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!visible.length && (
            <Empty
              title="No members found"
              description="Try another name or adjust your filters."
            />
          )}
          <div className="table-footer">
            <span>
              Showing {filtered.length ? (currentPage - 1) * 8 + 1 : 0}–
              {Math.min(currentPage * 8, filtered.length)} of {filtered.length} members
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
      </Revealed>
      <div className="info-banner">
        <Icon name="HeartHandshake" size={22} />
        <div>
          <strong>Membership means more.</strong>
          <p>
            Annual dues are ₹500. Members enjoy discounted event tickets and merchandise, all year
            long.
          </p>
        </div>
      </div>
      {adding && (
        <Modal
          title="Welcome someone new"
          description="A new face. A new connection. Let’s get them set up."
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              if (data.members.some((m) => m.email.toLowerCase() === f.email.toLowerCase())) {
                toast('A member with this email already exists.');
                return;
              }
              const member: Member = {
                id: uid('MEM'),
                name: f.name.trim(),
                email: f.email.trim(),
                course: f.course,
                role: f.role,
                status: f.paid === 'on' ? 'Active' : 'Pending',
                joined: today,
                expires: '2027-07-31',
              };
              update((d) => ({
                ...d,
                members: [member, ...d.members],
                transactions:
                  f.paid === 'on'
                    ? [
                        {
                          id: uid('TX'),
                          title: `Membership dues · ${member.name}`,
                          category: 'Membership',
                          amount: 500,
                          date: today,
                          status: 'Completed',
                        },
                        ...d.transactions,
                      ]
                    : d.transactions,
              }));
              close();
              toast(`${member.name} is now part of Skyline!`);
            }}
          >
            <Field label="Full name">
              <input name="name" required placeholder="e.g. Jamie Park" maxLength={80} />
            </Field>
            <Field label="Student email">
              <input name="email" type="email" required placeholder="jamie@skyline.edu" />
            </Field>
            <Field label="Course / department">
              <input name="course" required placeholder="e.g. Computer Science" />
            </Field>
            <Field label="Club role">
              <select name="role" defaultValue="Volunteer">
                <option>Volunteer</option>
                <option>Events lead</option>
                <option>Treasurer</option>
                <option>President</option>
              </select>
            </Field>
            <label className="check-label">
              <input type="checkbox" name="paid" disabled={cloudMode} />
              Annual dues received (₹500)
            </label>
            <p className="form-note">
              {cloudMode
                ? 'New members start pending. Pay through Membership, or waive dues in User management.'
                : 'Paid dues are automatically added to the club ledger. Membership runs through 31 July 2027.'}
            </p>
            <FormFooter onClose={close} label="Add member" />
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Member details" onClose={closeDetail}>
          <div className="member-profile">
            <Avatar name={detail.name} />
            <h3>{detail.name}</h3>
            <p>{detail.email}</p>
            <Badge tone={detail.status === 'Active' ? 'green' : 'gold'}>{detail.status}</Badge>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Member ID</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>Course</dt>
              <dd>{detail.course}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{detail.role}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{date(detail.joined)}</dd>
            </div>
            <div>
              <dt>Membership expires</dt>
              <dd>{date(detail.expires)}</dd>
            </div>
            <div>
              <dt>Member benefits</dt>
              <dd>Ticket & store discounts</dd>
            </div>
          </dl>
          {detail.status !== 'Active' && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}
            >
              {detail.status === 'Expiring' && (
                <Button
                  variant="secondary"
                  icon="Bell"
                  className="full-width"
                  onClick={() => {
                    sendRenewalReminders([detail]);
                  }}
                >
                  Send renewal reminder
                </Button>
              )}
              <Button icon="BadgeCheck" className="full-width" onClick={() => activate(detail)}>
                {detail.status === 'Expiring' ? 'Record renewal' : 'Record dues'} · ₹500
              </Button>
            </div>
          )}
          <p className="form-note">
            Dues received in person can be recorded here. Members can use their ID to verify
            membership at events.
          </p>
        </Modal>
      )}
    </>
  );
}
