import { useMemo, useState } from 'react';
import { promoCodeSchema } from '../../../../../shared/schemas.js';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { FormFooter } from '../../../shared/ui/FormFooter';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatCard } from '../../../shared/ui/StatCard';
import { formValues } from '../../../shared/ui/formValues';
import { clubRequest } from '../../commerce/api/commerce.api';
import { date, money, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import type { PointRules, PromoCode, Store } from '../../../shared/types/domain';
import { useSession } from '../../auth/session';
import { Revealed } from '../../../shared/components/PageMotion';
import '../../shop/styles/shop.css';

type PatchReply = { patch: Partial<Store> };

const DEFAULT_POINT_RULES: PointRules = {
  checkInEnabled: true,
  checkInPoints: 10,
  merchEnabled: true,
  merchRupeesPerPoint: 100,
  taskEnabled: true,
  taskDonePoints: 15,
};

export function ContributionsPage() {
  const { data, applyServerPatch, update, toast, selectedClub } = useStore();
  const { user, can } = useSession();
  const [addingPromo, setAddingPromo] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [pending, setPending] = useState(false);
  const pointRules: PointRules = { ...DEFAULT_POINT_RULES, ...(data.pointRules || {}) };
  const [ruleDraft, setRuleDraft] = useState<PointRules>(pointRules);
  const canEditRules = can('manage_members') || can('view_finance');

  const me = data.members.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
  const ledger = data.pointLedger || [];
  const promos = data.promos || [];
  const myLedger = useMemo(() => ledger.filter((e) => e.memberId === me?.id), [ledger, me?.id]);
  const totals = {
    participation: me?.participationPoints || 0,
    volunteer: me?.volunteerPoints || 0,
    contribution: me?.contributionPoints || 0,
  };
  const clubTotals = data.members.reduce(
    (acc, m) => ({
      participation: acc.participation + (m.participationPoints || 0),
      volunteer: acc.volunteer + (m.volunteerPoints || 0),
      contribution: acc.contribution + (m.contributionPoints || 0),
    }),
    { participation: 0, volunteer: 0, contribution: 0 },
  );

  return (
    <>
      <PageHeader
        eyebrow="SHOWING UP COUNTS"
        title="Points, promos & contributions"
        description="Participation from events, volunteer shifts, and merchandise contributions — plus club promo codes."
        action={
          can('manage_members') || can('manage_inventory') || canEditRules ? (
            <>
              {canEditRules && (
                <Button
                  icon="Settings2"
                  variant="secondary"
                  onClick={() => {
                    setRuleDraft({ ...DEFAULT_POINT_RULES, ...(data.pointRules || {}) });
                    setEditingRules(true);
                  }}
                >
                  Point rules
                </Button>
              )}
              {can('manage_members') && (
                <Button icon="Sparkles" variant="secondary" onClick={() => setAwarding(true)}>
                  Award points
                </Button>
              )}
              {can('manage_inventory') && (
                <Button icon="Sparkles" onClick={() => setAddingPromo(true)}>
                  New promo code
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <section className="card point-rules-card">
        <CardHeader
          title="How points are earned"
          subtitle="Club rules for automatic participation, volunteer, and contribution points."
          action={
            canEditRules ? (
              <Button
                variant="secondary"
                icon="Settings2"
                onClick={() => {
                  setRuleDraft({ ...DEFAULT_POINT_RULES, ...(data.pointRules || {}) });
                  setEditingRules(true);
                }}
              >
                Edit rules
              </Button>
            ) : undefined
          }
        />
        <div className="point-rules-grid">
          <article className={`point-rule-tile ${pointRules.checkInEnabled ? '' : 'is-off'}`}>
            <Icon name="Ticket" size={20} />
            <div>
              <strong>Event check-in</strong>
              <p>
                {pointRules.checkInEnabled
                  ? `${pointRules.checkInPoints} participation points when a member checks in`
                  : 'Automatic check-in points are turned off'}
              </p>
            </div>
          </article>
          <article className={`point-rule-tile ${pointRules.taskEnabled ? '' : 'is-off'}`}>
            <Icon name="HeartHandshake" size={20} />
            <div>
              <strong>Volunteer tasks</strong>
              <p>
                {pointRules.taskEnabled
                  ? `${pointRules.taskDonePoints} volunteer points when a task is marked Done`
                  : 'Automatic task points are turned off'}
              </p>
            </div>
          </article>
          <article className={`point-rule-tile ${pointRules.merchEnabled ? '' : 'is-off'}`}>
            <Icon name="ShoppingBag" size={20} />
            <div>
              <strong>Merchandise orders</strong>
              <p>
                {pointRules.merchEnabled
                  ? `1 contribution point for every ₹${pointRules.merchRupeesPerPoint} spent`
                  : 'Automatic merch contribution points are turned off'}
              </p>
            </div>
          </article>
        </div>
      </section>

      <div className="report-stats contributions-stats">
        <Revealed delay={0} pop>
          <StatCard
            icon="Ticket"
            label="Your participation"
            value={String(totals.participation)}
            tone="teal"
          />
        </Revealed>
        <Revealed delay={55} pop>
          <StatCard
            icon="HeartHandshake"
            label="Your volunteer points"
            value={String(totals.volunteer)}
            tone="purple"
          />
        </Revealed>
        <Revealed delay={110} pop>
          <StatCard
            icon="ShoppingBag"
            label="Your contribution points"
            value={String(totals.contribution)}
            tone="gold"
          />
        </Revealed>
        <Revealed delay={165} pop>
          <StatCard
            icon="UsersRound"
            label="Club points total"
            value={String(
              clubTotals.participation + clubTotals.volunteer + clubTotals.contribution,
            )}
            tone="green"
          />
        </Revealed>
      </div>

      <div className="contributions-layout">
        <Revealed as="section" className="card timeline-card">
          <CardHeader
            title="Activity Timeline"
            subtitle="Points earned from check-ins, volunteer work, and shop orders."
          />
          {myLedger.length ? (
            <div className="contributions-timeline">
              {myLedger.slice(0, 15).map((entry, idx) => (
                <div className="contribution-timeline-item" key={entry.id}>
                  <div className="timeline-date-badge">
                    <strong>{new Date(`${entry.date}T12:00:00`).getDate()}</strong>
                    <small>{date(entry.date, { month: 'short' }).toUpperCase()}</small>
                  </div>
                  <div className="timeline-bullet-track">
                    <span className={`timeline-dot ${entry.kind}`} />
                    {idx !== myLedger.slice(0, 15).length - 1 && (
                      <span className="timeline-connector" />
                    )}
                  </div>
                  <div className="timeline-item-content">
                    <div className="timeline-item-header">
                      <strong>{entry.reason}</strong>
                      <span className="points-award-pill">+{entry.points} pts</span>
                    </div>
                    <div className="timeline-item-footer">
                      <Badge
                        tone={
                          entry.kind === 'volunteer'
                            ? 'purple'
                            : entry.kind === 'contribution'
                              ? 'gold'
                              : 'teal'
                        }
                      >
                        {entry.kind}
                      </Badge>
                      <small>
                        {date(entry.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your ledger is ready"
              description="Check in at an event, finish a volunteer task, or place a merch order to earn points."
            />
          )}
        </Revealed>

        <Revealed delay={80} as="section" className="card promo-artifacts-card">
          <CardHeader
            title="Promo Vouchers & Passes"
            subtitle="Apply at merchandise checkout for exclusive discounts."
          />
          {promos.length ? (
            <div className="promo-ticket-grid">
              {promos.map((promo) => (
                <article
                  className={`promo-ticket-artifact ${promo.active ? 'active' : 'paused'}`}
                  key={promo.id}
                >
                  <div className="promo-ticket-stub">
                    <span className="promo-stub-code">{promo.code}</span>
                    <span className="promo-stub-notch left" />
                    <span className="promo-stub-notch right" />
                  </div>
                  <div className="promo-ticket-body">
                    <div className="promo-ticket-offer">
                      <strong>
                        {promo.type === 'percent'
                          ? `${promo.value}% OFF`
                          : `${money(promo.value)} OFF`}
                      </strong>
                      <Badge tone={promo.active ? 'green' : 'neutral'}>
                        {promo.active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="promo-ticket-desc">{promo.description}</p>
                    <div className="promo-ticket-meta">
                      <span>{promo.memberOnly ? '★ Members only' : 'Open to everyone'}</span>
                      {promo.minSubtotal ? <span>Min {money(promo.minSubtotal)}</span> : null}
                      <span>
                        {promo.redemptions}
                        {promo.maxRedemptions != null ? `/${promo.maxRedemptions}` : ''} redeemed
                      </span>
                    </div>
                    {can('manage_inventory') && (
                      <div className="promo-ticket-actions">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            update((d) => ({
                              ...d,
                              promos: (d.promos || []).map((p) =>
                                p.id === promo.id ? { ...p, active: !p.active } : p,
                              ),
                            }));
                            toast(
                              promo.active
                                ? `${promo.code} revoked — it can no longer be used at checkout.`
                                : `${promo.code} is active again.`,
                            );
                          }}
                        >
                          {promo.active ? 'Revoke' : 'Reactivate'}
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No promo codes yet"
              description="Create a promo voucher for your members."
            />
          )}
        </Revealed>
      </div>

      {can('manage_members') && (
        <section className="card scoreboard-card">
          <CardHeader
            title="Club Scoreboard & Leaderboard"
            subtitle="Top contributors across student activities. Equal scores share a rank; ranks begin when points are earned."
          />
          <div className="scoreboard-grid">
            {[...data.members]
              .map((m) => ({
                ...m,
                total:
                  (m.participationPoints || 0) +
                  (m.volunteerPoints || 0) +
                  (m.contributionPoints || 0),
              }))
              .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
              .slice(0, 8)
              .map((m, _index, leaders) => {
                const rank = m.total > 0 ? leaders.findIndex((p) => p.total === m.total) + 1 : 0;
                return (
                  <div className={`scoreboard-player-card rank-${rank}`} key={m.id}>
                    <div className="player-rank-chip">{rank ? '#' + rank : '—'}</div>
                    <div className="player-info">
                      <strong>{m.name}</strong>
                      <small>{m.role}</small>
                    </div>
                    <div className="player-points-breakdown">
                      <span title="Participation Points" className="pt-part">
                        <Icon name="Ticket" size={16} /> {m.participationPoints || 0}
                      </span>
                      <span title="Volunteer Points" className="pt-vol">
                        <Icon name="HeartHandshake" size={16} /> {m.volunteerPoints || 0}
                      </span>
                      <span title="Merch Contribution Points" className="pt-con">
                        <Icon name="ShoppingBag" size={16} /> {m.contributionPoints || 0}
                      </span>
                    </div>
                    <div className="player-total-badge">
                      <strong>{m.total}</strong>
                      <small>pts</small>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {addingPromo && can('manage_inventory') && (
        <Modal
          title="Create a promo code"
          description="Codes are validated by the demo commerce API at checkout."
          onClose={() => setAddingPromo(false)}
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              const code = f.code.trim().toUpperCase();
              if (!promoCodeSchema.safeParse(code).success) {
                toast('Use 4–16 letters or numbers for the code.');
                return;
              }
              if ((data.promos || []).some((p) => p.code === code)) {
                toast('That code already exists.');
                return;
              }
              const promo: PromoCode = {
                id: uid('PROMO'),
                code,
                type: f.type === 'percent' ? 'percent' : 'fixed',
                value: Number(f.value),
                active: true,
                maxRedemptions: Number(f.maxRedemptions) || undefined,
                redemptions: 0,
                memberOnly: f.memberOnly === 'yes',
                minSubtotal: Number(f.minSubtotal) || 0,
                description: f.description.trim(),
              };
              update((d) => ({ ...d, promos: [promo, ...(d.promos || [])] }));
              setAddingPromo(false);
              toast(`${code} is ready for merchandise checkout.`);
            }}
          >
            <Field label="Code">
              <input name="code" required placeholder="CAMPUS25" maxLength={16} />
            </Field>
            <div className="form-two">
              <Field label="Type">
                <select name="type" defaultValue="percent">
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed ₹ off</option>
                </select>
              </Field>
              <Field label="Value">
                <input name="value" type="number" min="1" max="90" required defaultValue="10" />
              </Field>
            </div>
            <div className="form-two">
              <Field label="Member only?">
                <select name="memberOnly" defaultValue="no">
                  <option value="no">Everyone</option>
                  <option value="yes">Active members</option>
                </select>
              </Field>
              <Field label="Min subtotal (₹)">
                <input name="minSubtotal" type="number" min="0" defaultValue="0" />
              </Field>
            </div>
            <Field label="Max redemptions">
              <input name="maxRedemptions" type="number" min="1" defaultValue="100" />
            </Field>
            <Field label="Description">
              <input name="description" required placeholder="Short shopper-facing note" />
            </Field>
            <FormFooter onClose={() => setAddingPromo(false)} label="Save promo" />
          </form>
        </Modal>
      )}

      {editingRules && canEditRules && (
        <Modal
          title="Point rules"
          description="Set the basis for automatic points. Manual awards still work separately."
          onClose={() => !pending && setEditingRules(false)}
          wide
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              try {
                const reply = await clubRequest<PatchReply>(selectedClub, '/points/rules', {
                  method: 'POST',
                  snapshot: data,
                  actor: user,
                  body: { rules: ruleDraft },
                });
                applyServerPatch(selectedClub, reply.patch);
                setEditingRules(false);
                toast('Point rules saved for this club.');
              } catch {
                update((d) => ({ ...d, pointRules: ruleDraft }));
                setEditingRules(false);
                toast('Point rules saved for this club.');
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="point-rules-form">
              <label className="point-rule-switch">
                <input
                  type="checkbox"
                  checked={ruleDraft.checkInEnabled}
                  onChange={(e) =>
                    setRuleDraft((r) => ({ ...r, checkInEnabled: e.target.checked }))
                  }
                />
                <span>
                  <strong>Event check-in points</strong>
                  <small>Award participation points when a member checks in at an event.</small>
                </span>
              </label>
              <Field label="Points per check-in">
                <input
                  type="number"
                  min={0}
                  max={500}
                  disabled={!ruleDraft.checkInEnabled}
                  value={ruleDraft.checkInPoints}
                  onChange={(e) =>
                    setRuleDraft((r) => ({ ...r, checkInPoints: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
              <label className="point-rule-switch">
                <input
                  type="checkbox"
                  checked={ruleDraft.taskEnabled}
                  onChange={(e) => setRuleDraft((r) => ({ ...r, taskEnabled: e.target.checked }))}
                />
                <span>
                  <strong>Volunteer task completion</strong>
                  <small>Award volunteer points the first time a task is marked Done.</small>
                </span>
              </label>
              <Field label="Points per completed task">
                <input
                  type="number"
                  min={0}
                  max={500}
                  disabled={!ruleDraft.taskEnabled}
                  value={ruleDraft.taskDonePoints}
                  onChange={(e) =>
                    setRuleDraft((r) => ({ ...r, taskDonePoints: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
              <label className="point-rule-switch">
                <input
                  type="checkbox"
                  checked={ruleDraft.merchEnabled}
                  onChange={(e) => setRuleDraft((r) => ({ ...r, merchEnabled: e.target.checked }))}
                />
                <span>
                  <strong>Merchandise spend</strong>
                  <small>Award contribution points from shop orders after discounts.</small>
                </span>
              </label>
              <Field label="Rupees spent per 1 contribution point">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  disabled={!ruleDraft.merchEnabled}
                  value={ruleDraft.merchRupeesPerPoint}
                  onChange={(e) =>
                    setRuleDraft((r) => ({
                      ...r,
                      merchRupeesPerPoint: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
              </Field>
            </div>
            <FormFooter
              onClose={() => setEditingRules(false)}
              label={pending ? 'Saving…' : 'Save rules'}
            />
          </form>
        </Modal>
      )}
      {awarding && can('manage_members') && (
        <Modal
          title="Award contribution points"
          description="Volunteer and participation points are saved through the demo API."
          onClose={() => !pending && setAwarding(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e);
              void (async () => {
                setPending(true);
                try {
                  const reply = await clubRequest<PatchReply>(selectedClub, '/points/award', {
                    snapshot: data,
                    actor: user,
                    body: {
                      memberId: f.memberId,
                      kind: f.kind,
                      points: Number(f.points),
                      reason: f.reason.trim(),
                    },
                  });
                  applyServerPatch(selectedClub, reply.patch);
                  setAwarding(false);
                  toast('Points awarded and recorded in the ledger.');
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Could not award points.');
                } finally {
                  setPending(false);
                }
              })();
            }}
          >
            <Field label="Member">
              <select name="memberId" required defaultValue={me?.id || data.members[0]?.id}>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-two">
              <Field label="Kind">
                <select name="kind" defaultValue="volunteer">
                  <option value="participation">Participation</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="contribution">Contribution</option>
                </select>
              </Field>
              <Field label="Points">
                <input name="points" type="number" min="1" max="500" required defaultValue="15" />
              </Field>
            </div>
            <Field label="Reason">
              <input name="reason" required placeholder="Bake sale shift · 2 hours" />
            </Field>
            <Button type="submit" icon="Check" disabled={pending}>
              {pending ? 'Saving…' : 'Award points'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
