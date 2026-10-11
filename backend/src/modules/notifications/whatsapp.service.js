import { normalizePhone } from '../../../../shared/schemas.js';
export class WhatsAppService {
  constructor({ env, fetchImpl = fetch }) {
    Object.assign(this, { env, fetchImpl });
  }
  async send(member, message) {
    const allowlist = String(this.env.META_TEST_RECIPIENTS || '')
      .split(',')
      .map(normalizePhone)
      .filter(Boolean);
    if (!member.whatsappOptIn || !allowlist.includes(normalizePhone(member.phone)))
      return {
        status: 'Failed',
        detail: 'WhatsApp requires saved consent and a verified Meta test recipient.',
      };
    if (!this.env.META_WHATSAPP_TOKEN || !this.env.META_PHONE_NUMBER_ID)
      return { status: 'Failed', detail: 'WhatsApp sender credentials are missing.' };
    const template = this.env.META_WHATSAPP_TEMPLATE;
    const count = Number(this.env.META_TEMPLATE_PARAMETER_COUNT || 0);
    const defaults = {
      0: [],
      1: ['body'],
      2: ['title', 'body'],
      3: ['name', 'title', 'body'],
      4: ['name', 'title', 'body', 'url'],
    };
    const fields = this.env.META_TEMPLATE_FIELDS
      ? this.env.META_TEMPLATE_FIELDS.split(',').map((f) => f.trim())
      : defaults[count];
    if (
      !template ||
      !fields ||
      fields.length !== count ||
      fields.some((f) => !['name', 'title', 'body', 'url'].includes(f))
    )
      return {
        status: 'Failed',
        detail: 'Configure the approved template and its body parameter fields.',
      };
    const values = {
      name: member.name,
      title: message.title,
      body: message.body,
      url: this.env.APP_ORIGIN + message.url,
    };
    const body = {
      messaging_product: 'whatsapp',
      to: normalizePhone(member.phone),
      type: 'template',
      template: {
        name: template,
        language: { code: this.env.META_TEMPLATE_LANGUAGE || 'en_US' },
        ...(count
          ? {
              components: [
                {
                  type: 'body',
                  parameters: fields.map((f) => ({
                    type: 'text',
                    text: String(values[f]).slice(0, 1000),
                  })),
                },
              ],
            }
          : {}),
      },
    };
    try {
      const response = await this.fetchImpl(
        `https://graph.facebook.com/${this.env.META_GRAPH_VERSION || 'v25.0'}/${this.env.META_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + this.env.META_WHATSAPP_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        },
      );
      const result = await response.json();
      if (response.ok && typeof result.messages?.[0]?.id === 'string')
        return {
          status: 'Sent',
          providerStatus: 'accepted',
          providerMessageId: result.messages[0].id,
          detail: `Meta accepted template ${template}. Device delivery awaits its webhook.${count ? '' : ' This static template has no content parameters; announcement/reminder text was not included.'}`,
        };
      const code = Number(result.error?.code) || 0;
      const explanation = {
        190: 'Access token expired or invalid. Replace META_WHATSAPP_TOKEN.',
        131030: 'Recipient is not verified for this Meta test sender.',
        132000: 'Template parameter count does not match the approved template.',
        132001: 'Template name or language is not approved for this sender.',
        131026: 'Meta could not deliver to this WhatsApp recipient.',
      };
      return {
        status: 'Failed',
        detail: `Meta rejected WhatsApp (HTTP ${response.status}, code ${code}). ${explanation[code] || 'Check the approved template and sender setup.'}`,
      };
    } catch {
      return {
        status: 'Unknown',
        detail:
          'WhatsApp acceptance is uncertain. Automatic resend is blocked to avoid duplicates.',
      };
    }
  }
}
