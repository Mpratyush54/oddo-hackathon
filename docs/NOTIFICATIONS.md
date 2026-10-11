# Notifications and reminders

The Express notification module separates planning, delivery, WhatsApp, email and browser push into services. Queued rows are durable work, not evidence that a recipient received a message. An AWS EventBridge rule invokes the Lambda every minute; staff can also dispatch a queue from Communications.

## Automatic reminders

All schedules use Asia/Kolkata. Membership expiry reminders run 30, 7, 1 and 0 days before expiry. Pending membership dues are reminded once per week from enrollment. Confirmed event tickets receive reminders within 24 hours and within one hour before the event. Checked-in, cancelled or refund-pending tickets are excluded. The optional weekly roundup runs on Sunday after 09:00, lists the next seven days of events, and requires the saved weekly preference.

Reminder markers and conditional delivery claims prevent repeated scheduled invocations from sending the same reminder twice. Before sending, services recheck the account, membership, ticket, preferences and WhatsApp consent. Members receive their own reminders in the app bell. Visible pages refresh notification state every 30 seconds and when returning to the page.

`Prepared` means queued. `Accepted` means the external service accepted a request. WhatsApp `Delivered` and `Read` require signed Meta webhooks. `Failed` requests can be explicitly retried by staff after fixing the cause. `Unknown` requests are not automatically retried because an unconfirmed timeout could already have sent a message. Connectivity tests are separate from real reminder deliveries.

## WhatsApp setup

Use `.env` locally and `node scripts/sync-provider-secrets.js` to update the AWS backend secret. Configure a valid `META_WHATSAPP_TOKEN`, sender `META_PHONE_NUMBER_ID`, `META_GRAPH_VERSION`, verified test recipients, approved template name/language and `META_APP_SECRET`. Tokens can expire independently of whether fields are present. A system-user token must have access to the sender and the required WhatsApp permissions.

The Communications connectivity button sends Meta's `hello_world` sample. It proves connectivity only; it does not contain announcement or reminder text. Sample order confirmation templates are unsuitable for club reminders. Pending templates cannot be sent.

For a three-parameter approved template, set:

```dotenv
META_WHATSAPP_TEMPLATE=skyline_reminder
META_TEMPLATE_LANGUAGE=en_US
META_TEMPLATE_PARAMETER_COUNT=3
META_TEMPLATE_FIELDS=name,title,body
```

Suggested text to submit (approval and category remain Meta's decision):

```text
Hi {{1}}, here is a reminder from Skyline about your club activity.
Reminder: {{2}}
Details: {{3}}
Please open your Skyline account to review it.
```

Provide meaningful sample values in WhatsApp Manager. The backend supports body text parameters, with fields `name`, `title`, `body`, and `url`. Zero parameters send only the fixed template text. Templates with headers, buttons or named parameters need a corresponding payload extension rather than this positional body mapping. The current test allowlist remains enforced, as does each member's saved WhatsApp opt-in.

Callback URL: `https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/webhooks/whatsapp`. Use the deployed `META_WEBHOOK_VERIFY_TOKEN` during Meta callback verification and subscribe the app to WhatsApp message events. `META_APP_SECRET` verifies the request's `X-Hub-Signature-256`. Do not put either secret in the browser or Git. Supplying the app secret alone does not subscribe Meta to the callback.

## Browser notifications

For the current test sender, `.env` uses Meta's `hello_world`, `en_US`, zero body parameters, and an empty `META_TEMPLATE_FIELDS`. This tests connectivity only: its fixed greeting cannot carry announcement or reminder content. The pending `msg` template must be approved and mapped before sending customized reminders. Sends remain restricted to consenting members whose saved phone matches `META_TEST_RECIPIENTS`; demo users have no phones and all outbound preferences disabled.

Generate VAPID keys once with `node scripts/setup-browser-push.js`, then sync provider secrets. Keep the private key server-side and stable; rotating keys requires browser subscriptions to be recreated. The public key is safe to expose. The Profile page offers Enable, Disable and Send test notification. Permission is requested only after clicking Enable.

Browser subscriptions are associated with the signed-in account and device, validated with Zod, and disabled on sign-out. A device changing accounts cannot keep receiving the earlier account's push. Expired subscriptions are disabled when the provider returns 404/410. Only new, unread notifications since enabling the device are pushed. Browser/device permissions and OS settings affect display; an accepted push is not proof of an OS notification. HTTPS is required outside localhost; supported iOS installations need the website added to the Home Screen.

Push endpoint hosts are explicitly restricted to supported Chrome/Firefox/Apple services. Browser delivery rows store a subscription hash rather than exposing its endpoint in the club delivery log.

## Deploying the scheduler

Fresh full infrastructure deployments include the rule and scoped Lambda invocation permission. Existing GitHub main pushes deploy code automatically. For an existing stack, first deploy the new handler, then run the owner-only infrastructure update:

```sh
node scripts/setup-notification-schedule.js
aws cloudformation wait stack-update-complete --stack-name skyline-campus-api --region ap-south-1
```

The pilot worker processes up to four deliveries per invocation within its Lambda time budget. Backlogs drain on subsequent minutes. It relies on the existing club aggregate size limit; larger installations need individual notification/entity records and a dedicated queue. Secrets Manager caches are loaded by the Lambda process, so code redeployment refreshes provider credentials.

Reference: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [web-push library](https://github.com/web-push-libs/web-push), and [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).
