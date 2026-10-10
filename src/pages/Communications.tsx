import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, CardHeader, Empty, Field, Icon, PageHeader, StatCard } from '../components';
import { date, exportCSV, today, uid, useStore } from '../store';
import { useSession } from '../session';
import '../communications.css';

type Channel = 'Email' | 'WhatsApp' | 'In-app';
type Draft = { title: string; body: string };
type ProviderHealth = { ai: { configured: boolean }; whatsapp: { configured: boolean } };
const apiURL =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ||
  '/api';
const audiences = ['All members', 'Active members', 'Volunteers', 'Pending dues', 'Renewing soon'];
const normalizePhone = (value: string) => value.replace(/\D/g, '');

export function CommunicationsPage() {
  const { data, update, toast } = useStore();
  const { user, can, clubId } = useSession();
  const currentClub = useRef(clubId);
  currentClub.current = clubId;
  const allowed = can('publish_announcement');
  const [tab, setTab] = useState('Feed');
  const [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [audience, setAudience] = useState('All members');
  const [email, setEmail] = useState(true),
    [whatsapp, setWhatsapp] = useState(false);
  const [notes, setNotes] = useState(''),
    [draft, setDraft] = useState<Draft | null>(null),
    [draftSource, setDraftSource] = useState(''),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiURL.replace(/\/$/, '')}/health`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (
          result &&
          typeof result.ai?.configured === 'boolean' &&
          typeof result.whatsapp?.configured === 'boolean'
        )
          setHealth(result);
      })
      .catch(() => {
        /* The page remains usable without the optional local service. */
      });
    return () => controller.abort();
  }, []);
  const matches = (member: (typeof data.members)[number], group = audience) =>
    group === 'All members' ||
    (group === 'Active members' && member.status === 'Active') ||
    (group === 'Volunteers' && member.role === 'Volunteer') ||
    (group === 'Pending dues' && member.status === 'Pending') ||
    (group === 'Renewing soon' && member.status === 'Expiring');
  const recipients = data.members.filter((m) => matches(m));
  const whatsappRecipients = recipients.filter((m) => m.whatsappOptIn && m.phone);
  const member = data.members.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
  const feed = data.announcements.filter(
    (a) =>
      (allowed || (!!member && matches(member, a.audience))) &&
      `${a.title} ${a.body}`.toLowerCase().includes(query.toLowerCase()),
  );

  const publish = (event: FormEvent) => {
    event.preventDefault();
    if (!allowed || !title.trim() || !body.trim() || !recipients.length) return;
    const id = uid('ANN');
    const announcement = {
      id,
      title: title.trim(),
      body: body.trim(),
      audience,
      date: today,
      author: user.name,
      read: 0,
      email,
      whatsapp,
      recipients: recipients.length,
    };
    const pending = recipients.flatMap((m) => {
      const channels: Channel[] = ['In-app'];
      if (email && m.email) channels.push('Email');
      if (whatsapp && m.whatsappOptIn && m.phone) channels.push('WhatsApp');
      return channels.map((channel) => ({
        id: uid('DEL'),
        announcementId: id,
        channel,
        recipient: channel === 'WhatsApp' ? m.phone! : m.email,
        status: channel === 'In-app' ? ('Sent' as const) : ('Prepared' as const),
        date: today,
        detail:
          channel === 'In-app'
            ? 'Published to the club feed'
            : 'Provider not connected. No message sent.',
      }));
    });
    update((d) => ({
      ...d,
      announcements: [announcement, ...d.announcements],
      deliveries: [...pending, ...(d.deliveries || [])],
      notifications: [
        {
          id: uid('NOT'),
          title: announcement.title,
          body: announcement.body,
          date: today,
          read: false,
          to: '/app/announcements',
          audience,
        },
        ...(d.notifications || []),
      ],
    }));
    toast(
      'Published to the club feed. Selected external messages are prepared; no outbound messages sent.',
    );
    setTitle('');
    setBody('');
    setDraft(null);
    setTab('Feed');
  };
  const generateDraft = async () => {
    if (!notes.trim() || !allowed) return;
    setBusy(true);
    if (apiURL) {
      try {
        const response = await fetch(`${apiURL.replace(/\/$/, '')}/ai/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ clubId, notes, audience, purpose: 'club-announcement' }),
          signal: AbortSignal.timeout(22000),
        });
        if (!response.ok) throw new Error('Draft service unavailable');
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== 'object' ||
          !('title' in result) ||
          !('body' in result) ||
          typeof result.title !== 'string' ||
          typeof result.body !== 'string'
        )
          throw new Error('Invalid draft response');
        setDraft({ title: result.title.slice(0, 140), body: result.body.slice(0, 5000) });
        setDraftSource('OpenRouter draft · review before publishing');
        setBusy(false);
        return;
      } catch {
        toast('AI service is unavailable. Prepared a template draft instead.');
      }
    }
    const bullets = notes
      .split('\n')
      .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
      .filter(Boolean);
    setDraft({
      title: bullets[0]?.slice(0, 100) || 'A community update',
      body: `Hi everyone,\n\n${bullets.join('\n\n')}\n\nPlease check your club dashboard for the latest details.\nSee you there!`,
    });
    setDraftSource('Template draft · AI provider not connected');
    setBusy(false);
  };
  const prepareReminder = (status: 'Pending' | 'Expiring') => {
    const group = data.members.filter((m) => m.status === status);
    const id = `REM-${status}-${today}`;
    if (data.deliveries?.some((d) => d.announcementId === id)) {
      toast('These reminders have already been prepared today.');
      return;
    }
    const deliveries = group.flatMap((m) =>
      (['Email', ...(m.whatsappOptIn && m.phone ? ['WhatsApp'] : [])] as Channel[]).map(
        (channel) => ({
          id: uid('DEL'),
          announcementId: id,
          channel,
          recipient: channel === 'WhatsApp' ? m.phone! : m.email,
          status: 'Prepared' as const,
          date: today,
          detail:
            status === 'Pending'
              ? 'Dues reminder prepared. Provider not connected.'
              : 'Renewal reminder prepared. Provider not connected.',
        }),
      ),
    );
    update((d) => ({ ...d, deliveries: [...deliveries, ...(d.deliveries || [])] }));
    toast(`${group.length} member reminders prepared. No outbound messages sent.`);
  };
  const copyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      toast('Message copied. You can share it manually.');
    } catch {
      toast('Clipboard unavailable. Select and copy the message text.');
    }
  };
  const sendWhatsAppTest = async (announcement: (typeof data.announcements)[number]) => {
    if (!allowed || sending) return;
    const sendingClub = clubId;
    const phones = [
      ...new Set(
        data.members
          .filter((m) => matches(m, announcement.audience) && m.whatsappOptIn && m.phone)
          .map((m) => normalizePhone(m.phone!)),
      ),
    ];
    if (!phones.length) {
      toast(
        'No opted-in phone numbers in this audience. Add your approved test number and consent in your profile.',
      );
      return;
    }
    setSending(announcement.id);
    try {
      const response = await fetch(`${apiURL.replace(/\/$/, '')}/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clubId,
          announcementId: announcement.id,
          title: announcement.title,
          body: announcement.body,
          channel: 'WhatsApp',
          recipients: phones,
          template: 'hello_world',
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          result &&
            typeof result === 'object' &&
            'error' in result &&
            typeof result.error === 'string'
            ? result.error
            : 'Test service unavailable. Check server configuration.',
        );
      if (
        !result ||
        typeof result !== 'object' ||
        !('deliveries' in result) ||
        !Array.isArray(result.deliveries)
      )
        throw new Error('Invalid delivery service response.');
      const records = result.deliveries.filter(
        (
          entry,
        ): entry is {
          recipient: string;
          channel: 'WhatsApp';
          status: 'Sent' | 'Failed';
          detail: string;
        } =>
          !!entry &&
          typeof entry === 'object' &&
          typeof entry.recipient === 'string' &&
          phones.includes(entry.recipient) &&
          entry.channel === 'WhatsApp' &&
          (entry.status === 'Sent' || entry.status === 'Failed') &&
          typeof entry.detail === 'string',
      );
      if (!records.length) throw new Error('No recipient delivery results were returned.');
      if (currentClub.current !== sendingClub) {
        toast(
          'Test finished for the previous club. Check the provider record; this club was not changed.',
        );
        return;
      }
      update((current) => {
        const existing = current.deliveries || [];
        const updated = existing.map((row) => {
          const resultRow = records.find(
            (item) =>
              row.announcementId === announcement.id &&
              row.channel === 'WhatsApp' &&
              normalizePhone(row.recipient) === item.recipient,
          );
          return resultRow
            ? {
                ...row,
                status: resultRow.status,
                date: today,
                detail: `hello_world connectivity test only; announcement content not sent. ${resultRow.detail}`,
              }
            : row;
        });
        const fresh = records
          .filter(
            (item) =>
              !existing.some(
                (row) =>
                  row.announcementId === announcement.id &&
                  row.channel === 'WhatsApp' &&
                  normalizePhone(row.recipient) === item.recipient,
              ),
          )
          .map((item) => ({
            id: uid('DEL'),
            announcementId: announcement.id,
            ...item,
            date: today,
            detail: `hello_world connectivity test only; announcement content not sent. ${item.detail}`,
          }));
        return { ...current, deliveries: [...fresh, ...updated] };
      });
      const sent = records.filter((row) => row.status === 'Sent').length;
      toast(
        `${sent} test template(s) accepted by provider; ${records.length - sent} failed. This test does not send your announcement content.`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'WhatsApp test could not be sent.');
    } finally {
      setSending(null);
    }
  };
  return (
    <div className="communications-page">
      <PageHeader
        eyebrow="YOUR COMMUNITY, IN THE LOOP"
        title={allowed ? 'Communications' : 'Community updates'}
        description={
          allowed
            ? 'Publish once. Keep every member informed, with a clear delivery record.'
            : 'Announcements, opportunities, and important dates from your club.'
        }
        action={
          allowed ? (
            <Button icon="PenLine" onClick={() => setTab('Compose')}>
              Write announcement
            </Button>
          ) : undefined
        }
      />
      {allowed && (
        <>
          <div className="three-stats comms-stats">
            <StatCard
              icon="Megaphone"
              label="Published updates"
              value={data.announcements.length}
            />
            <StatCard icon="UsersRound" label="Club audience" value={data.members.length} />
            <StatCard
              icon="Mail"
              label="WhatsApp opted in"
              value={data.members.filter((m) => m.whatsappOptIn && m.phone).length}
              note="Only members with phone + consent"
              tone="green"
            />
          </div>
          <div className="comms-provider">
            <Icon name="CircleHelp" />
            <div>
              <strong>Publish updates. Test WhatsApp explicitly.</strong>
              <p>
                Email stays prepared. WhatsApp uses your Meta test account through the server and
                only approved, opted-in test numbers. The test sends hello_world, not announcement
                content.
              </p>
            </div>
            <Badge tone={health?.whatsapp.configured ? 'green' : 'gold'}>
              {health?.whatsapp.configured
                ? 'Meta test configured'
                : 'Test provider setup required'}
            </Badge>
          </div>
          <div className="segmented comms-tabs" aria-label="Communication views">
            {['Feed', 'Compose', 'Delivery log'].map((t) => (
              <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'Feed' && (
        <div className="comms-layout">
          <section className="comms-feed">
            <label className="comms-search">
              <Icon name="Search" size={18} />
              <input
                aria-label="Search announcements"
                placeholder="Search community updates"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {feed.map((a, i) => (
              <article className="card comms-announcement" key={a.id}>
                <div className="comms-announcement-top">
                  <span className={`comms-feed-icon ${i === 0 ? 'featured' : ''}`}>
                    <Icon name="Megaphone" />
                  </span>
                  <div>
                    <span className="comms-meta">
                      {a.author} · {date(a.date)}
                    </span>
                    <h2>{a.title}</h2>
                  </div>
                </div>
                <p className="comms-body">{a.body}</p>
                <div className="comms-footer">
                  <Badge>{a.audience}</Badge>
                  <span>
                    <Icon name="Globe" size={15} /> Published in-app
                  </span>
                  {allowed && a.whatsapp && (
                    <Button
                      variant="secondary"
                      disabled={!!sending || health?.whatsapp.configured === false}
                      onClick={() => sendWhatsAppTest(a)}
                    >
                      {sending === a.id ? 'Sending test…' : 'Send WhatsApp test template'}
                    </Button>
                  )}
                  {allowed && (
                    <button
                      className="comms-text-button"
                      onClick={() => copyMessage(`${a.title}\n\n${a.body}`)}
                    >
                      Copy message
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!feed.length && (
              <Empty
                title="No updates yet"
                description="Published club announcements will appear here."
              />
            )}
          </section>
          <aside className="card comms-aside">
            <CardHeader
              title={allowed ? 'Helpful reminders' : 'Stay connected'}
              subtitle={
                allowed ? 'Keep membership admin moving.' : 'Your next opportunity starts here.'
              }
            />
            {allowed ? (
              <>
                {(['Pending', 'Expiring'] as const).map((s) => (
                  <div className="comms-reminder" key={s}>
                    <strong>
                      {data.members.filter((m) => m.status === s).length}{' '}
                      {s === 'Pending' ? 'members awaiting dues' : 'members renewing soon'}
                    </strong>
                    <p>
                      {s === 'Pending'
                        ? 'A gentle follow-up with membership payment details.'
                        : 'Let members know before their benefits expire.'}
                    </p>
                    <Button
                      variant="secondary"
                      icon="Bell"
                      disabled={!data.members.some((m) => m.status === s)}
                      onClick={() => prepareReminder(s)}
                    >
                      Prepare reminder
                    </Button>
                  </div>
                ))}
                <small>
                  Reminder preparation respects WhatsApp consent and prevents duplicate preparation
                  today.
                </small>
              </>
            ) : (
              <>
                <p>
                  Check your event bookings and membership benefits from your personal dashboard.
                </p>
                <a className="button secondary" href="/app/profile">
                  View my membership
                </a>
              </>
            )}
            <div className="comms-channel-note">
              <Icon name="ShieldCheck" />
              <p>
                WhatsApp messages require explicit opt-in. Members can manage consent in their
                profile.
              </p>
            </div>
          </aside>
        </div>
      )}
      {allowed && tab === 'Compose' && (
        <div className="comms-layout">
          <form className="card comms-composer" onSubmit={publish}>
            <CardHeader
              title="A new community update"
              subtitle="Clear, useful, and ready for your members."
            />
            <Field label="Headline">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="What should your members know?"
                required
              />
            </Field>
            <Field label="Message">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                maxLength={5000}
                placeholder="Include dates, location, and the next action."
                required
              />
            </Field>
            <Field label="Audience">
              <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                {audiences.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <div className="comms-audience-count">
              <Icon name="UsersRound" size={18} />
              {recipients.length} members in this audience
            </div>
            <h3 className="comms-section-label">Publication & delivery</h3>
            <div className="comms-channel">
              <Icon name="Globe" />
              <div>
                <strong>Club feed</strong>
                <p>Published immediately in this workspace.</p>
              </div>
              <Badge>Included</Badge>
            </div>
            <label className="comms-channel">
              <Icon name="Mail" />
              <div>
                <strong>Email</strong>
                <p>{recipients.filter((m) => m.email).length} addresses · prepared for delivery</p>
              </div>
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            </label>
            <label className="comms-channel">
              <Icon name="Bell" />
              <div>
                <strong>WhatsApp</strong>
                <p>{whatsappRecipients.length} opted-in numbers · prepared for delivery</p>
              </div>
              <input
                type="checkbox"
                checked={whatsapp}
                onChange={(e) => setWhatsapp(e.target.checked)}
              />
            </label>
            {whatsapp && (
              <p className="comms-help">
                {recipients.length - whatsappRecipients.length} members excluded from WhatsApp
                because no consent or phone is recorded. Approved templates and provider
                configuration will be required for automatic notifications.
              </p>
            )}
            <div className="comms-publish-actions">
              <Button type="submit" icon="Megaphone" disabled={!recipients.length}>
                Publish & prepare
              </Button>
              <Button
                variant="secondary"
                disabled={!title.trim() && !body.trim()}
                onClick={() => copyMessage(`${title}\n\n${body}`)}
              >
                Copy for WhatsApp
              </Button>
              {(title.trim() || body.trim()) && (
                <a
                  className="comms-text-button"
                  href={`https://wa.me/?text=${encodeURIComponent(`${title}\n\n${body}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open manual share ↗
                </a>
              )}
            </div>
            <p className="comms-help">
              Manual share opens WhatsApp for you to choose recipients and send. Publishing here
              does not send email or WhatsApp.
            </p>
          </form>
          <aside className="card comms-ai">
            <div className="comms-ai-title">
              <span className="icon-tile">
                <Icon name="Sparkles" />
              </span>
              <div>
                <h2>Draft assistant</h2>
                <p>Turn your notes into a clear update.</p>
              </div>
            </div>
            <Field label="Your bullet points">
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  'Bake sale on Friday\nCourtyard, 10 AM\nNeed 4 volunteers\nSign up on the task board'
                }
              />
            </Field>
            <Button
              variant="secondary"
              icon="Sparkles"
              disabled={busy || !notes.trim()}
              onClick={generateDraft}
            >
              {busy
                ? 'Preparing draft…'
                : health?.ai.configured
                  ? 'Draft with OpenRouter'
                  : 'Create draft'}
            </Button>
            <p className="comms-help">
              {health?.ai.configured
                ? 'OpenRouter free model through the server. Review names, dates, and claims before publishing.'
                : 'OpenRouter setup is pending. A clearly labelled template draft is available if the service is unavailable.'}
            </p>
            {draft && (
              <div className="comms-draft">
                <Badge tone="purple">{draftSource}</Badge>
                <h3>{draft.title}</h3>
                <p>{draft.body}</p>
                <Button
                  icon="PenLine"
                  onClick={() => {
                    setTitle(draft.title);
                    setBody(draft.body);
                    toast('Draft added to the editor. Review and edit before publishing.');
                  }}
                >
                  Use in editor
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
      {allowed && tab === 'Delivery log' && (
        <section className="card comms-deliveries">
          <CardHeader
            title="Publication & delivery history"
            subtitle="Prepared means no external message has been sent."
            action={
              <Button
                icon="Download"
                variant="secondary"
                onClick={() =>
                  exportCSV('communication-deliveries.csv', [
                    ['ID', 'Announcement', 'Channel', 'Recipient', 'Status', 'Date', 'Detail'],
                    ...(data.deliveries || []).map((d) => [
                      d.id,
                      d.announcementId,
                      d.channel,
                      d.recipient,
                      d.status,
                      d.date,
                      d.detail,
                    ]),
                  ])
                }
              >
                Export log
              </Button>
            }
          />
          {data.deliveries?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Update</th>
                    <th>Channel</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>
                          {data.announcements.find((a) => a.id === d.announcementId)?.title ||
                            'Membership reminder'}
                        </strong>
                        <small>{date(d.date)}</small>
                      </td>
                      <td>{d.channel}</td>
                      <td>{d.recipient}</td>
                      <td>
                        <Badge
                          tone={
                            d.status === 'Sent' ? 'green' : d.status === 'Failed' ? 'red' : 'gold'
                          }
                        >
                          {d.status === 'Sent' && d.channel === 'In-app' ? 'Published' : d.status}
                        </Badge>
                      </td>
                      <td>{d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No delivery records yet"
              description="Publish an update or prepare a membership reminder to see its record."
            />
          )}
        </section>
      )}
    </div>
  );
}
export default CommunicationsPage;
