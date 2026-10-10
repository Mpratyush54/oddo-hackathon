import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { createApi } from './api.js';
import { HttpError, clubKey, timestamp, recordId } from './repository.js';
import { matchesAudience, requireRole } from './domain.js';

const normalize = (value) => String(value).replace(/\D/g, '');
export function createProviders({ env, repo, domain, fetchImpl = fetch }) {
  const api = createApi({ env, fetchImpl });
  async function draft(clubId, user, body) {
    await domain.load(clubId);
    requireRole(await domain.roleFor(user, clubId), ['admin', 'organizer']);
    await repo.limit(
      `AI#${clubId}`,
      Math.max(1, Math.min(100, Number(env.AI_DAILY_LIMIT) || 30)),
      86400,
    );
    return api('/ai/draft', 'POST', {
      notes: body.notes,
      audience: body.audience,
      tone: body.tone,
    });
  }
  async function send(clubId, user, body) {
    requireRole(await domain.roleFor(user, clubId), ['admin', 'organizer']);
    if (
      !env.META_WHATSAPP_TOKEN ||
      !/^\d+$/.test(env.META_PHONE_NUMBER_ID || '') ||
      !/^v\d+\.0$/.test(env.META_GRAPH_VERSION || '')
    )
      throw new HttpError(
        503,
        'Configure the Meta test token, phone-number ID, and Graph version.',
      );
    if (body.channel !== 'WhatsApp')
      throw new HttpError(400, 'Only WhatsApp tests are configured.');
    const { data } = await domain.load(clubId),
      announcement = data.announcements.find((a) => a.id === body.announcementId);
    if (!announcement)
      throw new HttpError(404, 'Publish this announcement before testing WhatsApp.');
    const allowlist = new Set(
      String(env.META_TEST_RECIPIENTS || '')
        .split(',')
        .map(normalize)
        .filter(Boolean),
    );
    const eligible = data.members.filter(
      (m) => m.userId && m.whatsappOptIn && m.phone && matchesAudience(m, announcement.audience),
    );
    const requested = Array.isArray(body.recipients)
      ? [...new Set(body.recipients.map(normalize))]
      : [];
    if (
      !requested.length ||
      requested.length > 5 ||
      requested.some((p) => !allowlist.has(p) || !eligible.some((m) => normalize(m.phone) === p))
    )
      throw new HttpError(
        403,
        'Select up to five opted-in members who are approved Meta test recipients.',
      );
    const template = env.META_WHATSAPP_TEMPLATE || 'hello_world';
    if (template !== 'hello_world' || Number(env.META_TEMPLATE_PARAMETER_COUNT || 0) !== 0)
      throw new HttpError(503, 'This endpoint supports the hello_world connectivity test only.');
    await repo.limit(`WHATSAPP#${clubId}`, 10, 3600);
    const deliveries = await Promise.all(
      requested.map(async (recipient) => {
        const pk = clubKey(clubId),
          sk = `DELIVERY#${createHash('sha256').update(`${announcement.id}:hello_world:${recipient}`).digest('hex')}`;
        const existing = await repo.get(pk, sk);
        if (existing) return existing;
        let ledger = {
          pk,
          sk,
          id: recordId('DEL'),
          announcementId: announcement.id,
          recipient,
          channel: 'WhatsApp',
          status: 'Unknown',
          date: timestamp(),
          detail: 'Request is in progress or unconfirmed. Do not resend automatically.',
          actor: user.id,
        };
        if (!(await repo.put(ledger, true))) return repo.get(pk, sk);
        // Recheck the authoritative consent immediately before making a provider request.
        const fresh = (await domain.load(clubId)).data.members.find(
          (m) =>
            m.userId &&
            m.whatsappOptIn &&
            normalize(m.phone) === recipient &&
            matchesAudience(m, announcement.audience),
        );
        if (!fresh)
          ledger = { ...ledger, status: 'Failed', detail: 'Consent was withdrawn before sending.' };
        else {
          try {
            const response = await fetchImpl(
              `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: recipient,
                  type: 'template',
                  template: {
                    name: 'hello_world',
                    language: { code: env.META_TEMPLATE_LANGUAGE || 'en_US' },
                  },
                }),
                signal: AbortSignal.timeout(15000),
              },
            );
            const result = await response.json();
            if (response.ok && typeof result.messages?.[0]?.id === 'string') {
              ledger = {
                ...ledger,
                status: 'Sent',
                providerStatus: 'accepted',
                providerMessageId: result.messages[0].id,
                detail:
                  'Meta accepted the hello_world connectivity test. Announcement content was not sent; device delivery is not confirmed.',
              };
              await repo.put({
                pk: `MESSAGE#${ledger.providerMessageId}`,
                sk: 'DELIVERY',
                deliveryPk: pk,
                deliverySk: sk,
              });
              const early = await repo.get(`MESSAGE#${ledger.providerMessageId}`, 'STATUS');
              if (early) ledger = applyProviderStatus(ledger, early);
            } else
              ledger = {
                ...ledger,
                status: 'Failed',
                detail: `Meta rejected the connectivity test${result.error?.code ? ` (code ${result.error.code})` : ''}.`,
              };
          } catch {
            ledger = {
              ...ledger,
              status: 'Unknown',
              detail:
                'Provider acceptance is uncertain. Check Meta before retrying; automatic resend is blocked.',
            };
          }
        }
        await repo.put(ledger);
        await repo.put({
          pk,
          sk: `AUDIT#${timestamp()}#${recordId('AUD')}`,
          actor: user.id,
          clubId,
          collegeId: 'skyline-campus',
          action: 'whatsapp.test',
          entityId: ledger.id,
          date: timestamp(),
          detail: ledger.detail,
        });
        return ledger;
      }),
    );
    return { deliveries: deliveries.map(({ pk, sk, actor, ...row }) => row) };
  }
  function verifyWebhook(req) {
    if (!env.META_APP_SECRET)
      throw new HttpError(503, 'Meta webhook app secret is not configured.');
    const signature = String(req.headers['x-hub-signature-256'] || '');
    if (!/^sha256=[a-f0-9]{64}$/.test(signature))
      throw new HttpError(401, 'Invalid webhook signature.');
    const expected = createHmac('sha256', env.META_APP_SECRET).update(req.rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex')))
      throw new HttpError(401, 'Invalid webhook signature.');
  }
  async function webhook(body) {
    for (const entry of body.entry || [])
      for (const change of entry.changes || [])
        for (const status of change.value?.statuses || []) {
          if (
            typeof status.id !== 'string' ||
            !['sent', 'delivered', 'read', 'failed'].includes(status.status)
          )
            continue;
          const pk = `MESSAGE#${status.id}`,
            update = {
              pk,
              sk: 'STATUS',
              providerStatus: status.status,
              providerTimestamp: Number(status.timestamp) || 0,
            };
          const prior = await repo.get(pk, 'STATUS');
          if (prior && !newerStatus(prior, update)) continue;
          await repo.put(update);
          const mapping = await repo.get(pk, 'DELIVERY');
          if (mapping) {
            const row = await repo.get(mapping.deliveryPk, mapping.deliverySk);
            if (row && newerStatus(row, update)) await repo.put(applyProviderStatus(row, update));
          }
        }
  }
  return { draft, send, verifyWebhook, webhook };
}
const ranks = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 1 };
function newerStatus(prior, next) {
  return (
    (next.providerTimestamp || 0) >= (prior.providerTimestamp || 0) &&
    (ranks[next.providerStatus] || 0) >= (ranks[prior.providerStatus] || 0)
  );
}
function applyProviderStatus(row, status) {
  return {
    ...row,
    providerStatus: status.providerStatus,
    providerTimestamp: status.providerTimestamp,
    status: status.providerStatus === 'failed' ? 'Failed' : 'Sent',
    detail: `hello_world connectivity test only; announcement content not sent. Meta webhook reports: ${status.providerStatus}.`,
  };
}
