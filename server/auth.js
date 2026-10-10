import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError, timestamp, recordId } from './repository.js';

const scrypt = promisify(scryptCallback);
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const accountKey = (email) => 'ACCOUNT#' + hash(String(email).trim().toLowerCase());
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', 32768, 8, 1, salt, digest.toString('hex')].join(':');
}
export async function verifyPassword(password, encoded) {
  const parts = encoded.split(':');
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await scrypt(password, parts[4], 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function createAuth({ repo, env }) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 64)
    throw new Error('JWT_SECRET needs at least 64 characters.');
  const jwtKey = new TextEncoder().encode(env.JWT_SECRET);
  const secure = env.NODE_ENV === 'production';
  const accessName = secure ? '__Secure-skyline' : 'skyline-access';
  const refreshName = accessName + '-refresh';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/api' };
  const cookie = (req, name) =>
    String(req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + '='))
      ?.slice(name.length + 1);
  const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: !!user.emailVerified,
  });
  let dummyPassword;
  const readSession = async (req) => {
    const raw = cookie(req, accessName);
    if (!raw || raw.length > 3000) return null;
    let payload;
    try {
      ({ payload } = await jwtVerify(raw, jwtKey, {
        algorithms: ['HS256'],
        issuer: 'skyline-api',
        audience: 'skyline-web',
      }));
    } catch {
      return null;
    }
    if (typeof payload.jti !== 'string' || typeof payload.sub !== 'string') return null;
    const session = await repo.get('SESSION#' + payload.jti, 'SESSION');
    if (
      !session ||
      session.expiresAt <= Date.now() / 1000 ||
      session.revoked ||
      session.userId !== payload.sub
    )
      return null;
    const user = await repo.get('USER#' + session.userId, 'PROFILE');
    if (!user || user.sessionVersion !== session.sessionVersion || user.disabled) return null;
    return { session, user };
  };
  const newSession = async (res, user, previous) => {
    const refreshToken = randomBytes(32).toString('hex'),
      csrfToken = randomBytes(32).toString('hex'),
      jti = recordId('SESSION');
    const session = {
      pk: 'SESSION#' + jti,
      sk: 'SESSION',
      userId: user.id,
      sessionVersion: user.sessionVersion,
      csrfToken,
      revoked: false,
      expiresAt: Math.floor(Date.now() / 1000) + 7 * 86400,
    };
    const items = [
      { item: session, condition: 'attribute_not_exists(pk)' },
      {
        item: {
          pk: 'REFRESH#' + hash(refreshToken),
          sk: 'REFRESH',
          userId: user.id,
          sessionId: jti,
          revoked: false,
          expiresAt: session.expiresAt,
        },
        condition: 'attribute_not_exists(pk)',
      },
    ];
    if (previous)
      items.push(
        {
          item: { ...previous.refresh, revoked: true },
          condition: 'revoked = :false',
          values: { ':false': false },
        },
        {
          item: { ...previous.session, revoked: true },
          condition: 'revoked = :false',
          values: { ':false': false },
        },
      );
    if (!(await repo.atomic(items)))
      throw new HttpError(401, 'Refresh token has already been used. Sign in again.');
    const token = await new SignJWT({ version: user.sessionVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setJti(jti)
      .setIssuer('skyline-api')
      .setAudience('skyline-web')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(jwtKey);
    res.cookie(accessName, token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie(refreshName, refreshToken, { ...cookieOptions, maxAge: 7 * 86400 * 1000 });
    return { user: publicUser(user), csrfToken };
  };
  const credentials = (body) => {
    const email = String(body.email || '')
        .trim()
        .toLowerCase(),
      password = body.password;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof password !== 'string' ||
      password.length > 128
    )
      throw new HttpError(400, 'Enter a valid email and password.');
    return { email, password };
  };
  const routes = (app) => {
    app.post('/api/auth/signup', async (req, res) => {
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
    });
    app.post('/api/auth/login', async (req, res) => {
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
    });
    app.post('/api/auth/refresh', async (req, res) => {
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
    });
    app.get('/api/auth/me', async (req, res) => {
      const auth = await requireAuth(req),
        access = await repo.list('USER#' + auth.user.id, 'ACCESS#');
      res.json({
        user: publicUser(auth.user),
        csrfToken: auth.session.csrfToken,
        roles: Object.fromEntries(access.map((a) => [a.clubId, a.role])),
      });
    });
    app.post('/api/auth/logout', async (req, res) => {
      const auth = await requireAuth(req);
      await repo.put({ ...auth.session, revoked: true });
      res.clearCookie(accessName, cookieOptions);
      res.clearCookie(refreshName, cookieOptions);
      res.json({ ok: true });
    });
    app.post('/api/auth/password', async (req, res) => {
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
    });
  };
  async function requireAuth(req) {
    const auth = await readSession(req);
    if (!auth) throw new HttpError(401, 'Sign in to continue.');
    if (
      !['GET', 'HEAD'].includes(req.method) &&
      req.headers['x-csrf-token'] !== auth.session.csrfToken
    )
      throw new HttpError(403, 'Session verification failed. Reload and try again.');
    return auth;
  }
  return { routes, requireAuth };
}
