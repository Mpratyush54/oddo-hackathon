import { visibleState } from './club.service.js';
import { clubKey } from '../../shared/records.js';

export function createClubsController({ repo, domain, checkReceipt }) {
  return {
    getState: async (req, res) => {
      const { clubId } = req.params,
        role = await domain.roleFor(req.auth.user, clubId),
        current = await domain.load(clubId);
      const state = visibleState(current.data, req.auth.user, role);
      if (['admin', 'organizer'].includes(role)) {
        const actual = (await repo.list(clubKey(clubId), 'DELIVERY#')).map(
          ({ pk, sk, actor, ...row }) => row,
        );
        state.deliveries = [
          ...actual,
          ...state.deliveries.filter(
            (row) =>
              !actual.some(
                (sent) =>
                  sent.announcementId === row.announcementId &&
                  sent.channel === row.channel &&
                  sent.recipient === row.recipient.replace(/\D/g, ''),
              ),
          ),
        ];
      }
      res.json({ state, role, version: current.version });
    },
    executeAction: async (req, res) => {
      if (req.body.type === 'expenses.create')
        await checkReceipt(req.params.clubId, req.auth.user, req.body.args?.receiptKey);
      res.json(await domain.execute(req.params.clubId, req.body, req.auth.user));
    },
  };
}
