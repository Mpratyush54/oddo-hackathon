import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Progress } from '../../../shared/ui/Progress';
import { SearchField } from '../../../shared/ui/SearchField';
import { date, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { cloudMode } from '../../../shared/api/client';
import { Revealed } from '../../../shared/components/PageMotion';
import '../../finance/styles/finance.css';
import type { Ticket } from '../../../shared/types/domain';

export function CheckInPage() {
  const { data, update, applyServerPatch, toast, selectedClub } = useStore();
  const { can, clubId, user } = useSession();
  const [mode, setMode] = useState('ticket');
  const [memberResult, setMemberResult] = useState<{
    valid: boolean;
    name?: string;
    reason: string;
  } | null>(null);
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(params.get('event') || data.events[0]?.id || ''),
    [query, setQuery] = useState(''),
    [result, setResult] = useState<{ type: 'valid' | 'used' | 'invalid'; ticket?: Ticket } | null>(
      null,
    ),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCode = useRef('');
  const scanRef = useRef<(value: string) => void>(() => {});
  const scan = (value: string) => {
    if (!can('check_in')) {
      toast('Your role cannot scan or check in guests.');
      return;
    }
    if (mode === 'membership') {
      const pieces = value.trim().split(':');
      const correctClub = pieces[0] === 'SKYLINE' && pieces[1] === 'MEMBER' && pieces[2] === clubId;
      const member = correctClub ? data.members.find((m) => m.id === pieces[3]) : undefined;
      const valid =
        !!member &&
        member.status !== 'Pending' &&
        member.status !== 'Expired' &&
        member.expires >= today;
      setMemberResult({
        valid,
        name: member?.name,
        reason: !correctClub
          ? 'This card belongs to another club or is not a Skyline membership QR.'
          : !member
            ? 'Member not found.'
            : member.status === 'Pending'
              ? 'Dues are pending. Membership is not active.'
              : member.status === 'Expired' || member.expires < today
                ? 'This membership has expired.'
                : `Active until ${date(member.expires)}. No event ticket was consumed.`,
      });
      setCamera(false);
      return;
    }
    const ticket = data.tickets.find(
      (t) =>
        t.id.toLowerCase() === value.trim().toLowerCase() &&
        t.eventId === eventId &&
        t.status !== 'Cancelled',
    );
    if (!ticket) setResult({ type: 'invalid' });
    else if (ticket.checkedIn) setResult({ type: 'used', ticket });
    else {
      void (async () => {
        try {
          const { clubRequest } = await import('../../commerce/api/commerce.api');
          const reply = await clubRequest<{ patch: Parameters<typeof applyServerPatch>[1] }>(
            selectedClub,
            '/check-in',
            {
              snapshot: data,
              actor: user,
              body: { ticketId: ticket.id },
            },
          );
          applyServerPatch(selectedClub, reply.patch);
          setResult({ type: 'valid', ticket: { ...ticket, checkedIn: true } });
          toast(`${ticket.name} checked in. Participation points awarded when eligible.`);
        } catch (error) {
          if (cloudMode) {
            toast(error instanceof Error ? error.message : 'Check-in failed.');
            setResult({ type: 'invalid' });
            return;
          }
          update((d) => ({
            ...d,
            tickets: d.tickets.map((t) => (t.id === ticket.id ? { ...t, checkedIn: true } : t)),
          }));
          setResult({ type: 'valid', ticket });
          toast(`${ticket.name} checked in. Welcome to the event!`);
        }
      })();
    }
    setCamera(false);
  };
  scanRef.current = scan;
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        timer = setInterval(() => {
          if (!ctx || !video.videoWidth || cancelled) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data !== lastCode.current) {
            lastCode.current = code.data;
            scanRef.current(code.data);
          }
        }, 350);
      })
      .catch(() => {
        setCameraError(
          'Camera unavailable or permission denied. You can still check in using a ticket ID or name.',
        );
        setCamera(false);
      });
    if (!navigator.mediaDevices) {
      setCameraError('Camera scanning is unavailable in this browser. Use a ticket ID below.');
      setCamera(false);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);
  const tickets = data.tickets.filter((t) => t.eventId === eventId && t.status !== 'Cancelled');
  const checkedInCount = tickets.filter((t) => t.checkedIn).length;
  const remainingCount = tickets.length - checkedInCount;
  const attendancePercent = tickets.length
    ? Math.round((checkedInCount / tickets.length) * 100)
    : 0;

  const bulkCheckIn = () => {
    if (remainingCount === 0) {
      toast('All guests are already checked in.');
      return;
    }
    update((d) => ({
      ...d,
      tickets: d.tickets.map((t) =>
        t.eventId === eventId && t.status !== 'Cancelled' ? { ...t, checkedIn: true } : t,
      ),
    }));
    toast(`Checked in ${remainingCount} expected guests.`);
  };

  const filtered = tickets.filter((t) =>
    `${t.name} ${t.id} ${t.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (!can('check_in'))
    return (
      <Empty
        title="Check-in is for your event team"
        description="Open your member card or tickets from your personal workspace."
        action={<LinkButton to="/app/my-tickets">My tickets</LinkButton>}
      />
    );
  return (
    <>
      <Revealed>
        <PageHeader
          eyebrow="A WARM WELCOME AT THE DOOR"
          title="You’re in good company"
          description="Scan a ticket, say hello, and keep the line moving."
        />
        <div className="segmented scanner-mode">
          {['ticket', 'membership'].map((m) => (
            <button
              key={m}
              className={mode === m ? 'selected' : ''}
              onClick={() => {
                setMode(m);
                setResult(null);
                setMemberResult(null);
                setQuery('');
                setCamera(false);
              }}
            >
              {m === 'ticket' ? 'Event ticket check-in' : 'Verify membership'}
            </button>
          ))}
        </div>
        <div className="checkin-layout">
          <section className="card scanner-card">
            {mode === 'ticket' && (
              <Field label="Which event are we welcoming people to?">
                <select
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    setResult(null);
                    setQuery('');
                  }}
                >
                  {data.events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} · {date(e.date)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className={`scanner-view ${camera ? 'camera-active' : ''}`}>
              <div className="scanner-laser-beam" />
              {camera ? (
                <video ref={videoRef} muted playsInline />
              ) : (
                <>
                  <Icon name="QrCode" size={84} />
                  <h3>
                    {mode === 'membership'
                      ? 'Verify their membership.'
                      : 'A little scan. A big welcome.'}
                  </h3>
                  <p>
                    {mode === 'membership'
                      ? 'Scan a member card to check active dues, club and expiry.'
                      : 'Point your camera at a guest’s Skyline QR ticket.'}
                  </p>
                </>
              )}
              <span className="scanner-corner top-left" />
              <span className="scanner-corner top-right" />
              <span className="scanner-corner bottom-left" />
              <span className="scanner-corner bottom-right" />
            </div>
            <Button
              icon={camera ? 'CameraOff' : 'Camera'}
              className="full-width"
              onClick={() => {
                setCameraError('');
                lastCode.current = '';
                setCamera(!camera);
              }}
            >
              {camera ? 'Stop camera' : 'Start camera scanner'}
            </Button>
            {cameraError && (
              <p className="inline-error" role="alert">
                {cameraError}
              </p>
            )}
            <div className="or-divider">
              <span>
                {mode === 'membership' ? 'or enter a membership QR payload' : 'or use a ticket ID'}
              </span>
            </div>
            <form
              className="manual-scan"
              onSubmit={(e) => {
                e.preventDefault();
                scan(query);
              }}
            >
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={
                  mode === 'membership'
                    ? 'SKYLINE:MEMBER:club:member-id'
                    : 'Ticket ID (or find a guest below)...'
                }
              />
              <Button type="submit" icon="ArrowRight">
                Check ID
              </Button>
            </form>
            <p className="form-note">
              {mode === 'membership'
                ? `Membership QR format: SKYLINE:MEMBER:${clubId}:MEM-001. Verification does not check in an event ticket.`
                : 'Enter the exact ticket ID, or search a guest and use the row check-in button.'}
            </p>
          </section>
          <aside>
            {mode === 'ticket' && (
              <section className="card checkin-summary">
                <CardHeader
                  title="Tonight’s welcome"
                  action={
                    <span className="live-attendance-tag">
                      <span className="live-dot" /> Live Station
                    </span>
                  }
                />
                <div className="checkin-stat-grid">
                  <div className="checkin-stat">
                    <strong>
                      {checkedInCount}
                      <small> / {tickets.length}</small>
                    </strong>
                    <span>checked in ({attendancePercent}%)</span>
                  </div>
                  <div className="checkin-stat remaining">
                    <strong>{remainingCount}</strong>
                    <span>remaining expected</span>
                  </div>
                </div>
                <Progress
                  value={attendancePercent}
                  tone={attendancePercent === 100 ? 'green' : 'teal'}
                />
                <div className="arrival-pace-banner">
                  <Icon name="Activity" size={15} />
                  <span>
                    Pace:{' '}
                    {checkedInCount > 0
                      ? `${attendancePercent}% capacity arrived`
                      : 'Awaiting first arrival'}
                  </span>
                </div>
              </section>
            )}
            {memberResult && (
              <section
                className={`scan-result card ${memberResult.valid ? 'valid' : 'invalid'}`}
                role="status"
              >
                <Icon name={memberResult.valid ? 'BadgeCheck' : 'CircleX'} size={38} />
                <h2>{memberResult.valid ? 'Membership verified' : 'Membership not valid'}</h2>
                {memberResult.name && <h3>{memberResult.name}</h3>}
                <p>{memberResult.reason}</p>
              </section>
            )}
            {result && (
              <section className={`scan-result card ${result.type}`} role="status">
                <span className="result-icon">
                  <Icon
                    name={
                      result.type === 'valid'
                        ? 'CircleCheck'
                        : result.type === 'used'
                          ? 'CircleAlert'
                          : 'CircleX'
                    }
                    size={38}
                  />
                </span>
                <h2>
                  {result.type === 'valid'
                    ? 'Welcome, you’re in!'
                    : result.type === 'used'
                      ? 'Already checked in'
                      : 'Ticket not found'}
                </h2>
                {result.ticket ? (
                  <>
                    <h3>{result.ticket.name}</h3>
                    <p>{result.ticket.id}</p>
                    <Badge tone={result.ticket.member ? 'teal' : 'gold'}>
                      {result.ticket.member ? 'Skyline member' : 'Standard ticket'}
                    </Badge>
                  </>
                ) : (
                  <p>Check the ticket ID and selected event, then try again.</p>
                )}
                <Button
                  variant="secondary"
                  icon="ScanLine"
                  onClick={() => {
                    setResult(null);
                    setQuery('');
                    lastCode.current = '';
                  }}
                >
                  Next guest
                </Button>
              </section>
            )}
          </aside>
        </div>
      </Revealed>
      {mode === 'ticket' && (
        <Revealed delay={100}>
          <section className="card table-card checkin-guests">
            <div className="table-toolbar">
              <div>
                <h2>Your guests</h2>
                <span className="muted">
                  {filtered.length} tickets · {remainingCount} remaining expected
                </span>
              </div>
              {remainingCount > 0 && (
                <Button variant="secondary" icon="CheckCheck" onClick={bulkCheckIn}>
                  Check In All Expected ({remainingCount})
                </Button>
              )}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Ticket reference</th>
                    <th>Membership</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id}>
                      <td>
                        <div className="member-cell">
                          <Avatar name={t.name} index={i} />
                          <span>
                            <strong>{t.name}</strong>
                            <small>{t.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>{t.id}</td>
                      <td>{t.member ? 'Member' : 'Non-member'}</td>
                      <td>
                        <Badge tone={t.checkedIn ? 'green' : 'gold'}>
                          {t.checkedIn ? 'Checked in' : 'Expected'}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => scan(t.id)}
                          icon={t.checkedIn ? 'CircleCheck' : 'UserCheck'}
                        >
                          {t.checkedIn ? 'View status' : 'Check in'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <Empty title="No matching guests" description="Try a different name or ticket ID." />
            )}
          </section>
        </Revealed>
      )}
    </>
  );
}
