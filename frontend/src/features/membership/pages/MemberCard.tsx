import { useEffect, useState } from 'react';
import { hasActiveMembership } from '../../../../../shared/membership.js';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { backendPost, cloudMode } from '../../../shared/api/client';
import { razorpayCheckout } from '../../commerce/api/razorpay';
import type { Store } from '../../../shared/types/domain';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';
import {
  downloadMembershipCard,
  printMembershipCardImage,
  renderMembershipCardCanvas,
} from '../utils/renderMembershipCard';

export function MemberCard() {
  const { user, member, data } = usePersonal();
  const { update, toast, applyServerPatch, selectedClub } = useStore();
  const { clubs, clubId, can } = useSession();
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [joining, setJoining] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const clubName = clubs.find((c) => c.id === clubId)?.name || 'Skyline';
  const valid = hasActiveMembership(member, today);
  const awaitingApproval = !!member && member.joinApproved === false;
  const expiryTime = member?.expires ? new Date(`${member.expires}T23:59:59+05:30`).getTime() : 0;
  const nowTime = new Date(`${today}T00:00:00+05:30`).getTime();
  const daysUntilExpiry = member?.expires
    ? Math.ceil((expiryTime - nowTime) / (1000 * 60 * 60 * 24))
    : 0;
  const canRenew = !!member && valid && daysUntilExpiry <= 7;
  const needsDues = !!member && !awaitingApproval && !valid;
  const featuredProduct = data.products.find((p) => Object.values(p.stock).some((n) => n > 0));
  /** Card image only after admin approval and paid/active membership. */
  const cardInput =
    member && valid
      ? {
          clubName,
          name: user.name,
          course: member.course || 'Campus volunteer',
          memberId: member.id,
          role: member.role || 'Volunteer',
          expires: date(member.expires),
          valid: true,
          qrPayload: `SKYLINE:MEMBER:${clubId}:${member.id}`,
        }
      : null;
  const placeholderTitle = previewBusy
    ? 'Rendering your card…'
    : awaitingApproval
      ? 'Waiting for approval'
      : needsDues
        ? 'Payment required'
        : 'No membership card yet';
  const placeholderBody = previewBusy
    ? 'Building a device-independent card image.'
    : awaitingApproval
      ? 'Your join request is with an administrator. Your card appears only after they approve you and you pay dues.'
      : needsDues
        ? 'You are approved. Pay ₹500 dues to unlock your membership card.'
        : 'Request to join, get admin approval, then pay dues — your card is issued after that.';

  useEffect(() => {
    let cancelled = false;
    if (!cardInput) {
      setPreviewUrl('');
      return;
    }
    setPreviewBusy(true);
    void renderMembershipCardCanvas(cardInput)
      .then((result) => {
        if (!cancelled) setPreviewUrl(result.dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl('');
      })
      .finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cardInput?.clubName,
    cardInput?.name,
    cardInput?.course,
    cardInput?.memberId,
    cardInput?.role,
    cardInput?.expires,
    cardInput?.valid,
    cardInput?.qrPayload,
  ]);

  const joinClub = async () => {
    if (member || joining) return;
    setJoining(true);
    try {
      if (cloudMode) {
        const result = await backendPost<{ state: Store }>(`/clubs/${selectedClub}/actions`, {
          type: 'membership.join',
          args: {},
          idempotencyKey: crypto.randomUUID(),
        });
        applyServerPatch(selectedClub, result.state);
        toast('Join request sent. An administrator must approve you before you can pay dues.');
      } else {
        update((d) => ({
          ...d,
          members: [
            {
              id: uid('MEM'),
              name: user.name,
              email: user.email,
              course: 'Campus community',
              status: 'Pending' as const,
              joined: today,
              expires: today,
              role: 'Volunteer',
              joinApproved: false,
            },
            ...d.members,
          ],
        }));
        toast('Join request sent. Wait for an administrator to approve you.');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not join this club.');
    } finally {
      setJoining(false);
    }
  };

  const activateMembership = async () => {
    if (!member) return;
    if (cloudMode) {
      if (paying) return;
      setPaying(true);
      try {
        const reply = await razorpayCheckout(
          clubId,
          { type: 'membership.demo-dues', args: {} },
          user,
        );
        applyServerPatch(clubId, reply.state);
        toast('Razorpay test payment confirmed. Membership is active.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Membership payment failed.');
      } finally {
        setPaying(false);
      }
      return;
    }
    if (
      !window.confirm(
        'Activate annual membership for ₹500? Demo checkout — no real payment is taken.',
      )
    )
      return;
    const targetYear = Number(today.slice(0, 4)) + 1;
    const newExpiry = `${targetYear}-07-31`;
    update((d) => ({
      ...d,
      members: d.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: 'Active' as const,
              expires: newExpiry,
              joinApproved: true,
              role: m.role === 'Member' ? 'Volunteer' : m.role,
            }
          : m,
      ),
      transactions: [
        {
          id: uid('TX'),
          title: `Membership dues · ${user.name} (demo payment)`,
          category: 'Membership',
          amount: 500,
          date: today,
          status: 'Completed' as const,
          createdBy: user.id,
        },
        ...d.transactions,
      ],
    }));
    toast(cloudMode ? 'Membership is now active.' : 'Demo dues recorded. Membership card updated.');
  };

  const renewMembership = async () => {
    if (!member) return;
    if (valid && !canRenew) {
      toast(`Renewal opens 1 week before expiry (${date(member.expires)}).`);
      return;
    }
    if (cloudMode) {
      if (paying) return;
      setPaying(true);
      try {
        const reply = await razorpayCheckout(
          clubId,
          { type: 'membership.demo-dues', args: {} },
          user,
        );
        applyServerPatch(clubId, reply.state);
        toast('Razorpay test payment confirmed. Membership renewed.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Membership renewal failed.');
      } finally {
        setPaying(false);
      }
      return;
    }
    if (
      !window.confirm('Renew annual membership for ₹500? Demo checkout — no real payment is taken.')
    )
      return;
    const currentYear = Number((member.expires || today).slice(0, 4));
    const targetYear = Math.max(Number(today.slice(0, 4)), currentYear) + 1;
    const newExpiry = `${targetYear}-07-31`;
    update((d) => ({
      ...d,
      members: d.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: 'Active' as const,
              expires: newExpiry,
              role: m.role === 'Member' ? 'Volunteer' : m.role,
            }
          : m,
      ),
      transactions: [
        {
          id: uid('TX'),
          title: `Membership renewal · ${user.name} (demo payment)`,
          category: 'Membership',
          amount: 500,
          date: today,
          status: 'Completed' as const,
          createdBy: user.id,
        },
        ...d.transactions,
      ],
    }));
    toast(`Membership renewed until ${date(newExpiry)}.`);
  };

  const saveCard = async () => {
    if (!cardInput) {
      toast('Your membership card is available only after approval and payment.');
      return;
    }
    setSaving(true);
    try {
      const { blob, dataUrl } = await renderMembershipCardCanvas(cardInput);
      setPreviewUrl(dataUrl);
      downloadMembershipCard(blob, cardInput.memberId);
      toast('Membership card saved as PNG.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the card.');
    } finally {
      setSaving(false);
    }
  };

  const printCard = async () => {
    if (!cardInput) {
      toast('Your membership card is available only after approval and payment.');
      return;
    }
    setPrinting(true);
    try {
      const { dataUrl } = await renderMembershipCardCanvas(cardInput);
      setPreviewUrl(dataUrl);
      printMembershipCardImage(dataUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not print the card.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="member-card-page">
      <PageHeader
        eyebrow="MY CARD"
        title="Membership card"
        description="Issued after an administrator approves you and dues are paid. Then show it at the door or save it to your phone."
      />

      <div className="member-card-layout">
        <section className="member-card-face member-card-render-wrap">
          {previewUrl && valid ? (
            <img
              className="member-card-render"
              src={previewUrl}
              alt={`${user.name} membership card`}
              width={720}
              height={420}
            />
          ) : (
            <div className="member-card-placeholder">
              <Icon name="BadgeCheck" size={36} />
              <strong>{placeholderTitle}</strong>
              <p>{placeholderBody}</p>
              {!member && <Badge tone="neutral">Not enrolled</Badge>}
              {awaitingApproval && <Badge tone="gold">Awaiting admin approval</Badge>}
              {needsDues && <Badge tone="gold">Approved · pay dues</Badge>}
              {!member && (
                <Button icon="UserRoundPlus" disabled={joining} onClick={() => void joinClub()}>
                  {joining ? 'Sending…' : 'Request to join'}
                </Button>
              )}
              {needsDues && (
                <Button
                  icon="BadgeCheck"
                  disabled={paying || member?.refundPending}
                  onClick={() => void activateMembership()}
                >
                  {paying ? 'Opening checkout…' : 'Pay dues · ₹500'}
                </Button>
              )}
            </div>
          )}
        </section>

        <aside className="member-card-aside">
          {!member && (
            <section className="member-card-panel member-card-buy">
              <h3>Become a member</h3>
              <p>
                Send a join request. After an administrator approves you and you pay ₹500 dues, your
                membership card is issued here.
              </p>
              <div className="member-card-actions">
                <Button icon="UserRoundPlus" disabled={joining} onClick={() => void joinClub()}>
                  {joining ? 'Sending…' : 'Request to join'}
                </Button>
              </div>
            </section>
          )}
          {valid && (
            <section className="member-card-panel">
              <h3>Save or print</h3>
              <p>
                Preview, download, and print all use the same fixed canvas image — identical on
                every phone and laptop.
              </p>
              <div className="member-card-actions">
                {cloudMode && (
                  <LinkButton
                    to={`/app/refunds${member?.membershipPaymentId && !member.refundPending ? '?payment=' + encodeURIComponent(member.membershipPaymentId) : ''}`}
                    variant="secondary"
                  >
                    {member?.refundPending ? 'View membership refund' : 'Payments & refunds'}
                  </LinkButton>
                )}
                <Button icon="Download" disabled={saving} onClick={() => void saveCard()}>
                  {saving ? 'Saving…' : 'Save card PNG'}
                </Button>
                <Button
                  variant="secondary"
                  icon="FileCheck2"
                  disabled={printing}
                  onClick={() => void printCard()}
                >
                  {printing ? 'Preparing…' : 'Print card'}
                </Button>
              </div>
            </section>
          )}

          <section className="member-card-panel member-card-buy">
            <h3>Buy & activate</h3>
            <p>
              {awaitingApproval
                ? 'Your join request is waiting for an administrator. Payment unlocks after they approve you.'
                : !member
                  ? 'Join the club first, then activate dues or shop with membership.'
                  : valid
                    ? canRenew
                      ? `Your membership expires in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'} (${member?.expires ? date(member.expires) : ''}). You can renew now.`
                      : `Your membership is active until ${member?.expires ? date(member.expires) : ''}. Renewal opens 1 week before expiry.`
                    : member.status === 'Expired'
                      ? `Your membership expired on ${member?.expires ? date(member.expires) : ''}. Renew now to restore member prices and perks.`
                      : 'Activate dues for member prices on events and merchandise.'}
            </p>
            <div className="member-card-actions">
              {awaitingApproval && <Badge tone="gold">Awaiting admin approval</Badge>}
              {needsDues && (
                <Button
                  icon={member?.status === 'Expired' ? 'RefreshCw' : 'BadgeCheck'}
                  disabled={paying || member?.refundPending}
                  onClick={member?.status === 'Expired' ? renewMembership : activateMembership}
                >
                  {member?.status === 'Expired'
                    ? 'Renew membership · ₹500'
                    : 'Buy membership · ₹500'}
                </Button>
              )}
              {valid && (
                <Button
                  icon="RefreshCw"
                  disabled={!canRenew || paying || member?.refundPending}
                  onClick={renewMembership}
                  title={
                    canRenew
                      ? 'Renew membership for another year'
                      : `Renewal opens 1 week before expiry (${member?.expires ? date(member.expires) : ''})`
                  }
                >
                  Renew membership · ₹500
                </Button>
              )}
              {can('shop') && (
                <LinkButton to="/app/merchandise" icon="ShoppingBag" variant="secondary">
                  Buy merchandise
                </LinkButton>
              )}
              {can('shop') && featuredProduct && (
                <LinkButton
                  to={`/app/merchandise?product=${encodeURIComponent(featuredProduct.id)}`}
                  icon="Shirt"
                  variant="secondary"
                >
                  Shop {featuredProduct.name}
                </LinkButton>
              )}
              {can('book_ticket') && (
                <LinkButton to="/app/events" icon="Ticket" variant="secondary">
                  Browse events
                </LinkButton>
              )}
            </div>
          </section>

          <section className="member-card-panel member-card-benefits">
            <h3>With an active card</h3>
            <ul>
              <li>
                <Icon name="Ticket" size={16} /> Member ticket rates
              </li>
              <li>
                <Icon name="Shirt" size={16} /> Merchandise discounts
              </li>
              <li>
                <Icon name="QrCode" size={16} /> Door check-in via QR
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
