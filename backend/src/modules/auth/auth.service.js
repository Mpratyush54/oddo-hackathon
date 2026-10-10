import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError, recordId } from '../../shared/records.js';
import { hash } from './password.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRoutes } from './auth.routes.js';

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
  const routes = createAuthRoutes(
    createAuthController({
      repo,
      credentials,
      newSession,
      cookie,
      refreshName,
      requireAuth,
      publicUser,
      accessName,
      cookieOptions,
    }),
  );
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
