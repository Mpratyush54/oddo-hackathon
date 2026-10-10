import { useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { cloudMode } from '../../../shared/api/client';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { QR } from '../../../shared/components/QRCode';
import { usePersonal } from '../../account/hooks/usePersonal';

async function downloadCardPng(input: {
  clubName: string;
  name: string;
  course: string;
  memberId: string;
  expires: string;
  valid: boolean;
  qrPayload: string;
}) {
  const width = 720;
  const height = 420;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create card image.');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#143f34');
  gradient.addColorStop(1, '#0e635b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#e6c777';
  ctx.font = '700 28px Georgia, "Times New Roman", serif';
  ctx.fillText('skyline.', 36, 52);

  ctx.fillStyle = '#a4c9b6';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('VOLUNTEER MEMBERSHIP', 480, 48);
  ctx.fillText(input.clubName.toUpperCase(), 36, 96);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(input.name.slice(0, 28), 36, 148);

  ctx.fillStyle = '#d9eae1';
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText(input.course.slice(0, 40), 36, 182);

  ctx.fillStyle = '#a4c9b6';
  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillText(input.valid ? 'Valid membership' : 'Membership pending', 36, 230);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px ui-monospace, monospace';
  ctx.fillText(input.memberId, 36, 258);
  ctx.fillStyle = '#a4c9b6';
  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillText(`Expires ${input.expires}`, 36, 284);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(36, 330);
  ctx.lineTo(width - 36, 330);
  ctx.stroke();
  ctx.fillStyle = '#a4c9b6';
  ctx.fillText('Belong here. Build together.', 36, 368);

  const qrUrl = await QRCode.toDataURL(input.qrPayload, {
    width: 180,
    margin: 1,
    color: { dark: '#123f38', light: '#ffffff' },
  });
  const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render QR code.'));
    img.src = qrUrl;
  });
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, width - 230, 120, 194, 194, 16);
  ctx.fill();
  ctx.drawImage(qrImage, width - 220, 130, 174, 174);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${input.memberId || 'skyline'}-membership-card.png`;
  link.click();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function MemberCard() {
  const { user, member, data } = usePersonal();
  const { update, toast } = useStore();
  const { clubs, clubId, can } = useSession();
  const cardRef = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const clubName = clubs.find((c) => c.id === clubId)?.name || 'Skyline';
  const valid =
    !!member &&
    (member.status === 'Active' || member.status === 'Expiring') &&
    member.expires >= today;
  const needsDues = !!member && (!valid || member.status === 'Expiring');
  const featuredProduct = data.products.find((p) => Object.values(p.stock).some((n) => n > 0));
  const qrPayload = member ? `SKYLINE:MEMBER:${clubId}:${member.id}` : '';

  const activateMembership = () => {
    if (!member) return;
    if (
      !window.confirm(
        'Activate annual membership for ₹500? Demo checkout — no real payment is taken.',
      )
    )
      return;
    update((d) => ({
      ...d,
      members: d.members.map((m) =>
        m.id === member.id
          ? { ...m, status: 'Active' as const, expires: '2027-07-31', role: m.role === 'Member' ? 'Volunteer' : m.role }
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

  const saveCard = async () => {
    if (!member) {
      toast('Join the club first to save your card.');
      return;
    }
    setSaving(true);
    try {
      await downloadCardPng({
        clubName,
        name: user.name,
        course: member.course || 'Campus volunteer',
        memberId: member.id,
        expires: date(member.expires),
        valid,
        qrPayload,
      });
      toast('Membership card saved as PNG.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the card.');
    } finally {
      setSaving(false);
    }
  };

  const printCard = () => {
    if (!member) {
      toast('Join the club first to print your card.');
      return;
    }
    document.body.classList.add('printing-member-card');
    const cleanup = () => {
      document.body.classList.remove('printing-member-card');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => window.print(), 50);
  };

  return (
    <div className="member-card-page">
      <PageHeader
        eyebrow="MY CARD"
        title="Membership card"
        description="Show this at the door, save it to your phone, or buy merch with member prices."
      />

      <div className="member-card-layout">
        <section className="portal-digital-card member-card-face" ref={cardRef}>
          <div className="portal-card-top">
            <Logo to="/app/my-card" />
            <span>VOLUNTEER CARD</span>
          </div>
          <span className="portal-card-label">{clubName}</span>
          <h2>{user.name}</h2>
          <p>{member?.course || 'Campus volunteer'}</p>
          <div className="portal-card-qr">
            {member ? (
              <QR value={qrPayload} />
            ) : (
              <div className="member-card-qr-empty" aria-hidden="true">
                <Icon name="UserRoundPlus" size={48} />
              </div>
            )}
            <div>
              <Badge tone={valid ? 'teal' : member ? 'gold' : 'neutral'}>
                {valid ? 'Valid membership' : member ? 'Pending activation' : 'Not enrolled'}
              </Badge>
              <strong>{member?.id || 'Join to get an ID'}</strong>
              <small>
                {member
                  ? `${member.role || 'Volunteer'} · Expires ${date(member.expires)}`
                  : 'No membership on this club yet'}
              </small>
            </div>
          </div>
          <div className="portal-card-footer">
            <span>Belong here. Build together.</span>
            <Icon name="ShieldCheck" size={22} />
          </div>
        </section>

        <aside className="member-card-aside">
          <section className="member-card-panel">
            <h3>Save or print</h3>
            <p>Download a PNG for your camera roll, or print a clean card without the sidebar.</p>
            <div className="member-card-actions">
              <Button icon="Download" disabled={!member || saving} onClick={() => void saveCard()}>
                {saving ? 'Saving…' : 'Save card PNG'}
              </Button>
              <Button
                variant="secondary"
                icon="FileCheck2"
                disabled={!member}
                onClick={printCard}
              >
                Print card
              </Button>
            </div>
          </section>

          <section className="member-card-panel member-card-buy">
            <h3>Buy & activate</h3>
            <p>
              {needsDues
                ? 'Activate dues for member prices on events and merchandise.'
                : valid
                  ? 'Your membership is active. Pick up club merch anytime.'
                  : 'Join the club first, then activate dues or shop with membership.'}
            </p>
            <div className="member-card-actions">
              {needsDues && (
                <Button icon="BadgeCheck" onClick={activateMembership}>
                  Buy membership · ₹500
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
