import { UsersService } from './users.service.js';
import { userLookupSchema, userUpdateSchema, userRemoveSchema } from './users.schemas.js';
import { parseRequest } from '../../shared/request-validation.js';

export function registerUsersRoutes(app, dependencies) {
  const users = new UsersService(dependencies);
  app.get('/api/clubs/:clubId/users', async (req, res) =>
    res.json({ users: await users.list(req.auth.user, req.params.clubId) }),
  );
  app.post('/api/clubs/:clubId/users/lookup', async (req, res) => {
    const { email } = parseRequest(userLookupSchema, req.body);
    res.json(await users.lookup(req.auth.user, req.params.clubId, email));
  });
  app.post('/api/clubs/:clubId/users/update', async (req, res) =>
    res.json(
      await users.update(
        req.auth.user,
        req.params.clubId,
        parseRequest(userUpdateSchema, req.body),
      ),
    ),
  );
  app.post('/api/clubs/:clubId/users/remove', async (req, res) =>
    res.json(
      await users.remove(
        req.auth.user,
        req.params.clubId,
        parseRequest(userRemoveSchema, req.body),
      ),
    ),
  );
}
