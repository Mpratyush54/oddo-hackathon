export function createCommunicationsController({ providers }) {
  return {
    draftAnnouncement: async (req, res) =>
      res.json(await providers.draft(req.body.clubId, req.auth.user, req.body)),
    sendNotification: async (req, res) =>
      res.json(await providers.send(req.body.clubId, req.auth.user, req.body)),
  };
}
