import nodemailer from 'nodemailer';
import { z } from 'zod';
import { HttpError } from '../../shared/records.js';

const smtpSchema = z.object({
  SMTP_HOST: z.string().trim().min(1).max(253),
  SMTP_PORT: z.coerce
    .number()
    .refine((port) => [465, 587, 2525].includes(port))
    .default(587),
  SMTP_USER: z.string().trim().min(1),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM: z.email(),
});

export class EmailSenderService {
  constructor({ env, fetchImpl = fetch, smtpFactory = nodemailer.createTransport }) {
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.smtpFactory = smtpFactory;
  }
  validateConfiguration() {
    if (this.env.SMTP_HOST) {
      const result = smtpSchema.safeParse(this.env);
      if (!result.success)
        throw new HttpError(
          503,
          'Email verification needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and a verified EMAIL_FROM.',
        );
      this.smtp = result.data;
    } else if (!this.env.SENDGRID_API_KEY || !z.email().safeParse(this.env.EMAIL_FROM).success) {
      throw new HttpError(503, 'Email verification is not configured. Contact your administrator.');
    }
  }
  async send(to, text) {
    this.validateConfiguration();
    if (this.smtp) {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = this.smtp;
      const transport = this.smtpFactory({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        requireTLS: true,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        dnsTimeout: 10000,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      });
      try {
        const result = await transport.sendMail({
          from: { name: 'Skyline', address: EMAIL_FROM },
          to,
          subject: 'Verify your Skyline email',
          text,
        });
        if (!result.accepted?.some((address) => String(address).toLowerCase() === to.toLowerCase()))
          throw new HttpError(
            502,
            'The email provider rejected this recipient. Check the verified sender and recipient.',
          );
        return { accepted: true };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          502,
          error.code === 'EAUTH'
            ? 'SMTP authentication failed. Check the SMTP login and SMTP key.'
            : 'Verification email could not be sent. Check your email provider connection and verified sender.',
        );
      } finally {
        transport.close();
      }
    }
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
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.env.EMAIL_FROM, name: 'Skyline' },
          subject: 'Verify your Skyline email',
          content: [{ type: 'text/plain', value: text }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
          },
        }),
      });
    } catch {
      throw new HttpError(502, 'Verification email could not be sent. Please try again later.');
    }
    if (response.status !== 202)
      throw new HttpError(
        502,
        `SendGrid rejected the verification email (${response.status}). Check the API key and verified sender.`,
      );
    return { accepted: true };
  }
}
