import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hash } from './password.js';
import { HttpError } from '../../shared/records.js';
import { parseRequest } from '../../shared/request-validation.js';

const confirmSchema = z.strictObject({ token: z.hex().length(64) });

export class EmailVerificationService {
  constructor({ repo, env, fetchImpl = fetch }) {
    this.repo = repo;
    this.env = env;
    this.fetchImpl = fetchImpl;
  }
  async send(user) {
    if (user.emailVerified) return { verified: true };
    if (!this.env.SENDGRID_API_KEY || !z.email().safeParse(this.env.EMAIL_FROM).success)
      throw new HttpError(503, 'Email verification is not configured. Contact your administrator.');
    await this.repo.limit('VERIFY-EMAIL#' + user.id, 3, 3600);
    const origin = this.env.EMAIL_VERIFICATION_ORIGIN || this.env.APP_ORIGIN?.split(',')[0];
    let url;
    try {
      url = new URL('/verify-email', origin);
      if (
        url.protocol !== 'https:' &&
        !(this.env.NODE_ENV !== 'production' && url.protocol === 'http:')
      )
        throw new Error();
    } catch {
      throw new HttpError(503, 'Email verification URL is not configured.');
    }
    const token = randomBytes(32).toString('hex');
    url.hash = token;
    const record = {
      pk: 'VERIFY#' + hash(token),
      sk: 'EMAIL_VERIFICATION',
      userId: user.id,
      email: user.email,
      revoked: false,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    if (!(await this.repo.put(record, true)))
      throw new HttpError(503, 'Please request another verification email.');
    let response;
    try {
      response = await this.fetchImpl('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: 'Bearer ' + this.env.SENDGRID_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: user.email }] }],
          from: { email: this.env.EMAIL_FROM, name: 'Skyline' },
          subject: 'Verify your Skyline email',
          content: [
            {
              type: 'text/plain',
              value: `Verify your Skyline email by opening this link:\n\n${url.href}\n\nThis link expires in one hour. If you did not request it, ignore this email.`,
            },
          ],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
          },
        }),
      });
    } catch {
      await this.repo.put({ ...record, revoked: true });
      throw new HttpError(502, 'Verification email could not be sent. Please try again later.');
    }
    if (response.status !== 202) {
      await this.repo.put({ ...record, revoked: true });
      throw new HttpError(
        502,
        `SendGrid rejected the verification email (${response.status}). Check the API key and verified sender.`,
      );
    }
    return {
      accepted: true,
      message: 'Verification email requested. Check your inbox and spam folder.',
    };
  }
  async confirm(body) {
    const { token } = parseRequest(
      confirmSchema,
      body,
      'Use the verification link from your email.',
    );
    const record = await this.repo.get('VERIFY#' + hash(token), 'EMAIL_VERIFICATION');
    if (!record || record.revoked || record.expiresAt <= Date.now() / 1000)
      throw new HttpError(
        400,
        'This verification link has expired or already been used. Request a new email.',
      );
    const user = await this.repo.get('USER#' + record.userId, 'PROFILE');
    if (!user || user.disabled || user.email !== record.email)
      throw new HttpError(400, 'This verification link is no longer valid.');
    if (
      !(await this.repo.atomic([
        {
          item: { ...record, revoked: true },
          condition: 'revoked = :false',
          values: { ':false': false },
        },
        {
          item: { ...user, emailVerified: true },
          condition: 'sessionVersion = :version',
          values: { ':version': user.sessionVersion },
        },
      ]))
    )
      throw new HttpError(409, 'Your account changed. Request another verification email.');
    return { verified: true };
  }
}
