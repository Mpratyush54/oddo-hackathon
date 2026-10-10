import { createHash } from 'node:crypto';
import { HttpError, clubKey, dateToday, timestamp, recordId } from '../../shared/records.js';
import { quotePromo } from '../commerce/commerce.service.js';
import { accountKey } from '../auth/index.js';
import { requireRole } from '../../shared/authorization.js';
import { visibleState } from './club.views.js';

import { applyAction } from './actions.js';
export function createDomain({ repo, clubs }) {
  async function load(clubId) {
    if (!clubs.some((c) => c.id === clubId)) throw new HttpError(404, 'Club not found.');
    const item = await repo.get(clubKey(clubId), 'STATE');
    if (!item) throw new HttpError(503, 'Club data has not been initialized.');
    return item;
  }
  async function roleFor(user, clubId) {
    return (await repo.get(`USER#${user.id}`, `ACCESS#${clubId}`))?.role || 'member';
  }
  async function execute(clubId, action, user) {
    const pk = clubKey(clubId),
      role = await roleFor(user, clubId);
    if (typeof action.idempotencyKey !== 'string' || !/^[\w-]{8,100}$/.test(action.idempotencyKey))
      throw new HttpError(400, 'A unique idempotencyKey is required.');
    const sk = `REQUEST#${user.id}#${action.idempotencyKey}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ type: action.type, args: action.args || {} }))
      .digest('hex');
    const context = {};
    if (action.type === 'members.add') {
      requireRole(role, ['admin']);
      const account = await repo.get(accountKey(action.args?.member?.email || ''), 'ACCOUNT');
      if (account) context.targetUser = await repo.get(`USER#${account.id}`, 'PROFILE');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const cached = await repo.get(pk, sk);
      if (cached) {
        if (cached.fingerprint !== fingerprint)
          throw new HttpError(409, 'This request key was used for another action.');
        return { ...cached.result, state: visibleState((await load(clubId)).data, user, role) };
      }
      const current = await load(clubId);
      const { data, result } = applyAction(
        current.data,
        { ...action, clubId },
        user,
        role,
        dateToday(),
        context,
      );
      const audit = {
        id: recordId('AUD'),
        actor: user.id,
        clubId,
        collegeId: 'skyline-campus',
        action: action.type,
        entity: action.type.split('.')[0],
        entityId:
          result.ticket?.id ||
          result.announcement?.id ||
          action.args?.transactionId ||
          action.args?.ticketId ||
          clubId,
        date: timestamp(),
        detail: `${user.name} · ${action.type}`,
      };
      data.audit = [audit, ...(data.audit || [])].slice(0, 100);
      const { patch, ...safeResult } = result;
      if (
        await repo.commit(pk, current.version, data, audit, { sk, fingerprint, result: safeResult })
      )
        return { ...safeResult, state: visibleState(data, user, role) };
    }
    throw new HttpError(
      409,
      'Another update is in progress. Reload and retry using the same request key.',
    );
  }
  return {
    load,
    roleFor,
    execute,
    quote: (data, args, user) =>
      quotePromo(data, { ...args, email: user.email, today: dateToday() }),
  };
}

export { applyAction } from './actions.js';
export { visibleState, publicState } from './club.views.js';
export { requireRole, allowedRoles } from '../../shared/authorization.js';
export { matchesAudience } from '../communications/audience.js';
