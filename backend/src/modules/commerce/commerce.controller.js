import { HttpError } from '../../shared/records.js';

export function createCommerceController({ domain }) {
  return {
    executeCommerce: (type) => async (req, res) => {
      if (req.body.snapshot || req.body.actor)
        throw new HttpError(
          400,
          'Cloud operations do not accept browser snapshots or actor identities.',
        );
      const result = await domain.execute(
        req.body.clubId,
        { type, args: req.body, idempotencyKey: req.body.idempotencyKey },
        req.auth.user,
      );
      res.json({ ...result, patch: result.state });
    },
    quotePromo: async (req, res) =>
      res.json(domain.quote((await domain.load(req.body.clubId)).data, req.body, req.auth.user)),
  };
}
