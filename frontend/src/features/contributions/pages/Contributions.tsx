import { useMemo, useState } from 'react';
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
import type { PromoCode, Store } from '../../../shared/types/domain';
import { useSession } from '../../auth/session';
import { Revealed } from '../../../shared/components/PageMotion';
import '../../shop/styles/shop.css';

type PatchReply = { patch: Partial<Store> };

export function ContributionsPage() {
  const { data, applyServerPatch, update, toast, selectedClub } = useStore();
  const { user, can } = useSession();
  const [addingPromo, setAddingPromo] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [pending, setPending] = useState(false);

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
          can('manage_members') || can('manage_inventory') ? (
            <>
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
        <section className="card table-card scoreboard-card">
          <CardHeader
            title="Club Scoreboard & Leaderboard"
            subtitle="Top contributors ranked across all student activities."
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
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((m, rank) => (
                <div className={`scoreboard-player-card rank-${rank + 1}`} key={m.id}>
                  <div className="player-rank-chip">#{rank + 1}</div>
                  <div className="player-info">
                    <strong>{m.name}</strong>
                    <small>{m.role}</small>
                  </div>
                  <div className="player-points-breakdown">
                    <span title="Participation Points" className="pt-part">
                      🎟️ {m.participationPoints || 0}
                    </span>
                    <span title="Volunteer Points" className="pt-vol">
                      🤝 {m.volunteerPoints || 0}
                    </span>
                    <span title="Merch Contribution Points" className="pt-con">
                      🛍️ {m.contributionPoints || 0}
                    </span>
                  </div>
                  <div className="player-total-badge">
                    <strong>{m.total}</strong>
                    <small>pts</small>
                  </div>
                </div>
              ))}
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
              if (!/^[A-Z0-9]{4,16}$/.test(code)) {
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
