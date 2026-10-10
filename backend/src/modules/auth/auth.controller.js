import { HttpError, timestamp, recordId } from '../../shared/records.js';
import { hash, accountKey, hashPassword, verifyPassword } from './password.js';

export function createAuthController({
  repo,
  credentials,
  newSession,
  cookie,
  refreshName,
  requireAuth,
  publicUser,
  accessName,
  cookieOptions,
}) {
  let dummyPassword;
  return {
    signup: async (req, res) => {
      await repo.limit('SIGNUP#' + hash(req.ip || ''), 5, 3600);
      const { email, password } = credentials(req.body),
        name = String(req.body.name || '').trim();
      if (password.length < 12 || name.length < 2 || name.length > 80)
        throw new HttpError(
          400,
          'Use a name of 2–80 characters and a password of at least 12 characters.',
        );
      const id = recordId('USR');
      const account = {
        pk: accountKey(email),
        sk: 'ACCOUNT',
        id,
        passwordHash: await hashPassword(password),
      };
      const user = {
        pk: 'USER#' + id,
        sk: 'PROFILE',
        id,
        name,
        email,
        emailVerified: false,
        sessionVersion: 1,
        createdAt: timestamp(),
      };
      if (
        !(await repo.atomic([
          { item: account, condition: 'attribute_not_exists(pk)' },
          { item: user, condition: 'attribute_not_exists(pk)' },
        ]))
      )
        throw new HttpError(409, 'An account already exists. Sign in instead.');
      res.status(201).json(await newSession(res, user));
    },
    login: async (req, res) => {
      const { email, password } = credentials(req.body);
      await repo.limit('LOGIN-IP#' + hash(req.ip || ''), 30, 900);
      await repo.limit('LOGIN-ACCOUNT#' + hash(email), 10, 900);
      dummyPassword ??= await hashPassword('random-unused-account-password');
      const account = await repo.get(accountKey(email), 'ACCOUNT');
      const valid = await verifyPassword(password, account?.passwordHash || dummyPassword);
      if (!account || !valid) throw new HttpError(401, 'Email or password is incorrect.');
      const user = await repo.get('USER#' + account.id, 'PROFILE');
      if (!user || user.disabled) throw new HttpError(401, 'Email or password is incorrect.');
      res.json(await newSession(res, user));
    },
    refresh: async (req, res) => {
      const raw = cookie(req, refreshName);
      if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new HttpError(401, 'Sign in to continue.');
      const refresh = await repo.get('REFRESH#' + hash(raw), 'REFRESH');
      if (!refresh || refresh.expiresAt <= Date.now() / 1000)
        throw new HttpError(401, 'Sign in to continue.');
      const session = await repo.get('SESSION#' + refresh.sessionId, 'SESSION'),
        user = await repo.get('USER#' + refresh.userId, 'PROFILE');
      if (refresh.revoked) {
        if (user && user.sessionVersion === session?.sessionVersion)
          await repo.atomic([
            {
              item: { ...user, sessionVersion: user.sessionVersion + 1 },
              condition: 'sessionVersion = :version',
              values: { ':version': user.sessionVersion },
            },
          ]);
        throw new HttpError(401, 'Refresh token reuse detected. Sign in again.');
      }
      if (
        !session ||
        session.revoked ||
        !user ||
        user.disabled ||
        user.sessionVersion !== session.sessionVersion
      )
        throw new HttpError(401, 'Sign in to continue.');
      res.json(await newSession(res, user, { refresh, session }));
    },
    me: async (req, res) => {
      const auth = await requireAuth(req),
        access = await repo.list('USER#' + auth.user.id, 'ACCESS#');
      res.json({
        user: publicUser(auth.user),
        csrfToken: auth.session.csrfToken,
        roles: Object.fromEntries(access.map((a) => [a.clubId, a.role])),
      });
    },
    logout: async (req, res) => {
      const auth = await requireAuth(req);
      await repo.put({ ...auth.session, revoked: true });
      res.clearCookie(accessName, cookieOptions);
      res.clearCookie(refreshName, cookieOptions);
      res.json({ ok: true });
    },
    changePassword: async (req, res) => {
      const { user } = await requireAuth(req);
      await repo.limit('PASSWORD#' + user.id, 5, 3600);
      if (
        typeof req.body.password !== 'string' ||
        req.body.password.length < 12 ||
        req.body.password.length > 128 ||
        typeof req.body.currentPassword !== 'string' ||
        req.body.currentPassword.length > 128
      )
        throw new HttpError(400, 'Use a new password of 12–128 characters.');
      const account = await repo.get(accountKey(user.email), 'ACCOUNT');
      if (!(await verifyPassword(req.body.currentPassword, account.passwordHash)))
        throw new HttpError(401, 'Current password is incorrect.');
      const updated = { ...user, sessionVersion: user.sessionVersion + 1 };
      if (
        !(await repo.atomic([
          { item: { ...account, passwordHash: await hashPassword(req.body.password) } },
          {
            item: updated,
            condition: 'sessionVersion = :version',
            values: { ':version': user.sessionVersion },
          },
        ]))
      )
        throw new HttpError(409, 'Your account changed. Sign in again.');
      res.json(await newSession(res, updated));
    },
  };
}
