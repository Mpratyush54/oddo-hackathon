import { useEffect, useRef, useState } from 'react';
import { normalizePhone, removeTrailingSlash } from '../../../../../shared/schemas.js';
import type { FormEvent } from 'react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatCard } from '../../../shared/ui/StatCard';
import { Revealed } from '../../../shared/components/PageMotion';
import { date, exportCSV, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { backendHeaders, backendRequest, cloudMode } from '../../../shared/api/client';
import '../styles/communications.css';

type Channel = 'Email' | 'WhatsApp' | 'In-app';
type Draft = { title: string; body: string };
type ProviderHealth = { ai: { configured: boolean }; whatsapp: { configured: boolean } };
const apiURL =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ||
  '/api';
const audiences = ['All members', 'Active members', 'Volunteers', 'Pending dues', 'Renewing soon'];
async function integrationRequest(path: string, body: unknown, timeout: number): Promise<unknown> {
  const options = {
    method: 'POST',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  };
  if (cloudMode) return backendRequest(path, options);
  const response = await fetch(`${removeTrailingSlash(apiURL)}${path}`, {
    ...options,
    headers: backendHeaders(),
    credentials: 'include',
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result?.error === 'string' ? result.error : 'Provider service unavailable.',
    );
  return result;
}

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
  const [aiTone, setAiTone] = useState<'hype' | 'professional' | 'reminder'>('hype');
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({
    'ANN-1': { '👏': 14, '❤️': 8, '🎉': 12, '💡': 5 },
  });
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [health, setHealth] = useState<ProviderHealth | null>(null);

  const toggleReaction = (annId: string, emoji: string) => {
    setReactions((prev) => {
      const current = prev[annId] || {};
      const count = current[emoji] || 0;
      return {
        ...prev,
        [annId]: {
          ...current,
          [emoji]: count + 1,
        },
      };
    });
    toast(`Reacted with ${emoji}`);
  };

  const formatWhatsAppBroadcast = (annTitle: string, annBody: string) => {
    return `📢 *${annTitle.trim()}*\n📍 *Skyline Campus Community*\n\n${annBody.trim()}\n\n👉 *View details & RSVP on Skyline:* ${window.location.origin}/app/announcements\n— _Skyline Student Association_`;
  };

  const copyWhatsAppBroadcast = async (annTitle: string, annBody: string) => {
    const formatted = formatWhatsAppBroadcast(annTitle, annBody);
    await copyMessage(formatted);
    toast('WhatsApp broadcast formatted & copied to clipboard! Ready to paste in campus chats.');
  };

  const openWhatsAppShare = (annTitle: string, annBody: string) => {
    const formatted = formatWhatsAppBroadcast(annTitle, annBody);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(formatted)}`, '_blank');
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${removeTrailingSlash(apiURL)}/health`, { signal: controller.signal })
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
    toast('Published to the campus bulletin! Broadcast ready for sharing.');
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
        const result = await integrationRequest(
          '/ai/draft',
          { clubId, notes, audience, purpose: 'club-announcement', tone: aiTone },
          22000,
        );
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
        setDraftSource(`OpenRouter AI (${aiTone} tone) · review before publishing`);
        setBusy(false);
        return;
      } catch {
        toast('AI service is offline. Prepared crafted template with chosen tone.');
      }
    }
    const bullets = notes
      .split('\n')
      .map((line) => {
        const content = line.trim();
        return ['-', '•', '*'].includes(content[0]) ? content.slice(1).trim() : content;
      })
      .filter(Boolean);

    let draftTitle = bullets[0]?.slice(0, 100) || 'Campus Community Update';
    let draftBody = '';

    if (aiTone === 'hype') {
      draftTitle = `🔥 ${bullets[0]?.slice(0, 90) || 'Get Ready: Huge Campus Update!'}`;
      draftBody = `Hey Skyline Community! 🚀\n\n${bullets.map((b) => `✨ ${b}`).join('\n')}\n\nDon't miss out on this one — mark your calendars and bring a friend! 🙌\nCheck details on the Skyline app.`;
    } else if (aiTone === 'reminder') {
      draftTitle = `⏰ Friendly Reminder: ${bullets[0]?.slice(0, 80) || 'Upcoming Activity'}`;
      draftBody = `Hi everyone,\n\nA quick heads-up on our upcoming schedule:\n\n${bullets.map((b) => `📌 ${b}`).join('\n')}\n\nPlease take action or check in if needed. Thank you!\n— Skyline Team`;
    } else {
      draftTitle = `Announcement: ${bullets[0]?.slice(0, 80) || 'Community Notice'}`;
      draftBody = `Dear Members,\n\nPlease review the following campus update:\n\n${bullets.map((b) => `• ${b}`).join('\n')}\n\nFor any questions or agenda items, please reach out through the member portal.\n\nBest regards,\nExecutive Committee`;
    }

    setDraft({
      title: draftTitle,
      body: draftBody,
    });
    setDraftSource(`AI Assistant (${aiTone} tone) · Ready to edit`);
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
      toast('Message copied to clipboard.');
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
      const result = await integrationRequest(
        '/notifications/send',
        {
          clubId,
          announcementId: announcement.id,
          title: announcement.title,
          body: announcement.body,
          channel: 'WhatsApp',
          recipients: phones,
          template: 'hello_world',
        },
        20000,
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
          status: 'Sent' | 'Failed' | 'Unknown';
          detail: string;
        } =>
          !!entry &&
          typeof entry === 'object' &&
          typeof entry.recipient === 'string' &&
          phones.includes(entry.recipient) &&
          entry.channel === 'WhatsApp' &&
          (entry.status === 'Sent' || entry.status === 'Failed' || entry.status === 'Unknown') &&
          typeof entry.detail === 'string',
      );
      if (!records.length) throw new Error('No recipient delivery results were returned.');
      if (currentClub.current !== sendingClub) {
        toast(
          'Test finished for the previous club. Check the provider record; this club was not changed.',
        );
        return;
      }
      if (cloudMode) window.dispatchEvent(new Event('skyline-data-changed'));
      else
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
              note="Members with consent"
              tone="green"
            />
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
        <Revealed delay={40}>
          <div className="comms-layout">
            <section className="comms-feed bulletin-feed">
              <div className="bulletin-feed-header">
                <div>
                  <span className="bulletin-overline">OFFICIAL DISPATCH WALL</span>
                  <h2>Campus Bulletin</h2>
                </div>
                {allowed && (
                  <Button icon="PenLine" onClick={() => setTab('Compose')}>
                    Post update
                  </Button>
                )}
              </div>

              <label className="comms-search">
                <Icon name="Search" size={18} />
                <input
                  aria-label="Search announcements"
                  placeholder="Search campus bulletin by topic or keyword..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>

              {feed.map((a, i) => {
                const postReactions =
                  reactions[a.id] ||
                  (i === 0 ? { '👏': 12, '❤️': 6, '🎉': 9 } : { '👏': 3, '❤️': 1 });
                const authorIndex = data.members.findIndex((m) => m.name === a.author);

                return (
                  <article className="card comms-announcement bulletin-card" key={a.id}>
                    <div className="bulletin-header-row">
                      <div className="bulletin-author-info">
                        <Avatar name={a.author} index={authorIndex >= 0 ? authorIndex : i} small />
                        <div>
                          <strong className="bulletin-author-name">{a.author}</strong>
                          <span className="bulletin-date-text">
                            {date(a.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <Badge tone={i === 0 ? 'teal' : 'neutral'}>{a.audience}</Badge>
                    </div>

                    <h2 className="bulletin-headline">{a.title}</h2>
                    <p className="comms-body bulletin-content">{a.body}</p>

                    <div className="bulletin-interactions">
                      <div className="bulletin-reactions-bar">
                        {(['👏', '❤️', '🎉', '💡'] as const).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="bulletin-reaction-pill"
                            onClick={() => toggleReaction(a.id, emoji)}
                            title={`React with ${emoji}`}
                          >
                            <span>{emoji}</span>
                            <span className="reaction-count">{postReactions[emoji] || 0}</span>
                          </button>
                        ))}
                      </div>

                      <div className="bulletin-share-actions">
                        <Button
                          variant="secondary"
                          icon="Share2"
                          onClick={() => copyWhatsAppBroadcast(a.title, a.body)}
                        >
                          WhatsApp Broadcast
                        </Button>
                        <button
                          type="button"
                          className="comms-text-button wa-direct-link"
                          onClick={() => openWhatsAppShare(a.title, a.body)}
                          title="Open WhatsApp directly with prefilled message"
                        >
                          Share ↗
                        </button>
                      </div>
                    </div>

                    {allowed && a.whatsapp && (
                      <div className="bulletin-staff-actions">
                        <Button
                          variant="white"
                          disabled={!!sending || health?.whatsapp.configured === false}
                          onClick={() => sendWhatsAppTest(a)}
                        >
                          {sending === a.id ? 'Sending test…' : 'Meta test template'}
                        </Button>
                        <button
                          className="comms-text-button"
                          onClick={() => copyMessage(`${a.title}\n\n${a.body}`)}
                        >
                          Copy raw text
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}

              {!feed.length && (
                <Empty
                  title="No bulletins found"
                  description="Published campus announcements and notices will appear on this wall."
                />
              )}
            </section>

            <aside className="card comms-aside">
              <CardHeader
                title={allowed ? 'Bulletin Desk' : 'Campus Notice Board'}
                subtitle={
                  allowed ? 'Fast actions for club communicators.' : 'Your campus hub at a glance.'
                }
              />
              {allowed ? (
                <>
                  <div className="comms-fast-actions">
                    <Button
                      icon="Sparkles"
                      className="full-width"
                      onClick={() => setTab('Compose')}
                    >
                      AI Announcement Studio
                    </Button>
                  </div>
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
                </>
              ) : (
                <>
                  <p>Stay up to date with events, club initiatives, and membership perks.</p>
                  <a className="button secondary" href="/app/profile">
                    View my membership
                  </a>
                </>
              )}

              {/* Staff and technical diagnostic buried in collapsible details */}
              {allowed && (
                <details className="comms-provider-collapsed">
                  <summary>
                    <Icon name="Settings2" size={14} />
                    <span>Provider & WhatsApp Config</span>
                  </summary>
                  <div className="provider-collapsed-body">
                    <p>
                      Email stays prepared. WhatsApp uses your Meta test account through the server.
                    </p>
                    <Badge tone={health?.whatsapp.configured ? 'green' : 'gold'}>
                      {health?.whatsapp.configured ? 'Meta test ready' : 'Setup required'}
                    </Badge>
                  </div>
                </details>
              )}
            </aside>
          </div>
        </Revealed>
      )}

      {allowed && tab === 'Compose' && (
        <Revealed delay={40}>
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
                  <strong>Campus Bulletin Feed</strong>
                  <p>Published immediately on the bulletin wall.</p>
                </div>
                <Badge>Included</Badge>
              </div>
              <label className="comms-channel">
                <Icon name="Mail" />
                <div>
                  <strong>Email</strong>
                  <p>
                    {recipients.filter((m) => m.email).length} addresses · prepared for delivery
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(e) => setEmail(e.target.checked)}
                />
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

              <div className="comms-publish-actions">
                <Button type="submit" icon="Megaphone" disabled={!recipients.length}>
                  Publish to Bulletin
                </Button>
                <Button
                  variant="secondary"
                  icon="Share2"
                  disabled={!title.trim() && !body.trim()}
                  onClick={() => copyWhatsAppBroadcast(title, body)}
                >
                  Copy WhatsApp Broadcast
                </Button>
                {(title.trim() || body.trim()) && (
                  <button
                    type="button"
                    className="comms-text-button wa-direct-link"
                    onClick={() => openWhatsAppShare(title, body)}
                  >
                    Open WhatsApp Share ↗
                  </button>
                )}
              </div>
            </form>

            <aside className="card comms-ai">
              <div className="comms-ai-title">
                <span className="icon-tile">
                  <Icon name="Sparkles" />
                </span>
                <div>
                  <h2>AI Announcement Composer</h2>
                  <p>Turn quick bullet points into a polished bulletin.</p>
                </div>
              </div>

              <div className="ai-tone-selector">
                <span className="ai-tone-label">Select Tone:</span>
                <div className="ai-tone-pills">
                  {(['hype', 'professional', 'reminder'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`ai-tone-pill ${aiTone === t ? 'active' : ''}`}
                      onClick={() => setAiTone(t)}
                    >
                      {t === 'hype'
                        ? '🔥 Campus Hype'
                        : t === 'professional'
                          ? '📋 Professional'
                          : '🔔 Friendly Reminder'}
                    </button>
                  ))}
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
                {busy ? 'Crafting draft…' : `Draft with AI (${aiTone})`}
              </Button>

              {draft && (
                <div className="comms-draft">
                  <Badge tone="purple">{draftSource}</Badge>
                  <h3>{draft.title}</h3>
                  <p>{draft.body}</p>
                  <div className="draft-actions-bar">
                    <Button
                      icon="PenLine"
                      onClick={() => {
                        setTitle(draft.title);
                        setBody(draft.body);
                        toast('Draft applied to editor! Review and publish.');
                      }}
                    >
                      Apply to editor
                    </Button>
                    <Button
                      variant="white"
                      icon="Share2"
                      onClick={() => copyWhatsAppBroadcast(draft.title, draft.body)}
                    >
                      Copy as Broadcast
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </Revealed>
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
