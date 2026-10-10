export const createAuthenticate =
  ({ auth, repo }) =>
  async (req, res, next) => {
    if (req.path.startsWith('/webhooks/')) return next();
    try {
      req.auth = await auth.requireAuth(req);
      await repo.limit(`API#${req.auth.user.id}`, 90, 60);
      next();
    } catch (error) {
      next(error);
    }
  };
