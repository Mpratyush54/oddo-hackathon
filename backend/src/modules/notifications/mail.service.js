import nodemailer from 'nodemailer';
export class MailService {
  constructor({ env, fetchImpl = fetch, transport }) {
    Object.assign(this, { env, fetchImpl });
    this.transport =
      transport ||
      (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
        ? nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: Number(env.SMTP_PORT || 587),
            secure: Number(env.SMTP_PORT) === 465,
            requireTLS: true,
            disableFileAccess: true,
            disableUrlAccess: true,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
          })
        : null);
  }
  async send(member, message) {
    if (!this.env.EMAIL_FROM || (!this.transport && !this.env.SENDGRID_API_KEY))
      return { status: 'Failed', detail: 'Email sender is not configured.' };
    try {
      const text = message.body + '\n\n' + this.env.APP_ORIGIN + message.url;
      if (this.transport) {
        const result = await this.transport.sendMail({
          from: this.env.EMAIL_FROM,
          to: member.email,
          subject: message.title,
          text,
        });
        if (!result.accepted?.length)
          return { status: 'Failed', detail: 'SMTP rejected the recipient.' };
      } else {
        const response = await this.fetchImpl('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + this.env.SENDGRID_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: member.email }] }],
            from: { email: this.env.EMAIL_FROM },
            subject: message.title,
            content: [{ type: 'text/plain', value: text }],
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
          return {
            status: 'Failed',
            detail: `Email provider rejected the message (HTTP ${response.status}).`,
          };
      }
      return {
        status: 'Sent',
        providerStatus: 'accepted',
        detail:
          'Email provider accepted the reminder or announcement. Inbox delivery is not confirmed.',
      };
    } catch (error) {
      return {
        status: error.responseCode || error.code === 'EAUTH' ? 'Failed' : 'Unknown',
        detail:
          'Email delivery was not confirmed. Check SMTP sender credentials and provider logs.',
      };
    }
  }
}
