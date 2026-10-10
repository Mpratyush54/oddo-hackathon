import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  CardHeader,
  Empty,
  Field,
  FormFooter,
  Icon,
  Modal,
  PageHeader,
  StatCard,
  formValues,
} from '../components';
import { clubRequest } from '../api';
import { date, money, uid, useStore } from '../store';
import type { PromoCode, Store } from '../store';
import { useSession } from '../session';
import { Revealed } from '../components/PageMotion';
import '../shop.css';

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
  const myLedger = useMemo(
    () => ledger.filter((e) => e.memberId === me?.id),
    [ledger, me?.id],
  );
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
        <Revealed as="section" className="card table-card">
          <CardHeader
            title="Your recent activity"
            subtitle="Earned from check-ins, volunteer work, and shop orders."
          />
          {myLedger.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Kind</th>
                    <th>Reason</th>
                    <th className="numeric">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {myLedger.slice(0, 20).map((entry) => (
                    <tr key={entry.id}>
                      <td>{date(entry.date)}</td>
                      <td>
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
                      </td>
                      <td>{entry.reason}</td>
                      <td className="numeric">+{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Your ledger is ready"
              description="Check in at an event, finish a volunteer task, or place a merch order to earn points."
            />
          )}
        </Revealed>

        <Revealed delay={80} as="section" className="card table-card">
          <CardHeader
            title="Active promo codes"
            subtitle="Try WELCOME10, MEMBER50, or CAMPUS100 at merchandise checkout."
          />
          {promos.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Offer</th>
                    <th>Rules</th>
                    <th>Uses</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => (
                    <tr key={promo.id}>
                      <td>
                        <strong>{promo.code}</strong>
                        <small className="cell-subtext">{promo.description}</small>
                      </td>
                      <td>
                        {promo.type === 'percent'
                          ? `${promo.value}% off`
                          : `${money(promo.value)} off`}
                      </td>
                      <td>
                        {promo.memberOnly ? 'Members only' : 'Everyone'}
                        {promo.minSubtotal
                          ? ` · min ${money(promo.minSubtotal)}`
                          : ''}
                      </td>
                      <td>
                        {promo.redemptions}
                        {promo.maxRedemptions != null ? ` / ${promo.maxRedemptions}` : ''}
                      </td>
                      <td>
                        <Badge tone={promo.active ? 'green' : 'neutral'}>
                          {promo.active ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No promo codes yet" />
          )}
        </Revealed>
      </div>

      {can('manage_members') && (
        <section className="card table-card">
          <CardHeader title="Club leaderboard" subtitle="Top contributors across all point kinds." />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="numeric">Participation</th>
                  <th className="numeric">Volunteer</th>
                  <th className="numeric">Contribution</th>
                  <th className="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...data.members]
                  .map((m) => ({
                    ...m,
                    total:
                      (m.participationPoints || 0) +
                      (m.volunteerPoints || 0) +
                      (m.contributionPoints || 0),
                  }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 12)
                  .map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.name}</strong>
                        <small className="cell-subtext">{m.role}</small>
                      </td>
                      <td className="numeric">{m.participationPoints || 0}</td>
                      <td className="numeric">{m.volunteerPoints || 0}</td>
                      <td className="numeric">{m.contributionPoints || 0}</td>
                      <td className="numeric">
                        <strong>{m.total}</strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
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
