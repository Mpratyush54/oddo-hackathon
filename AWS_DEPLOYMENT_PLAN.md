# Skyline: simple AWS deployment plan

Updated 10 October 2026. Use the existing OpenRouter free access and Meta WhatsApp test account directly. AWS hosts the frontend, server, and shared data. No cloud deployment or provider messages have been performed by the agent.

## Smallest practical stack

| Part           | Choice                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| React frontend | Private S3 bucket + CloudFront; default CloudFront URL initially                                                    |
| API            | API Gateway HTTP API + Lambda; use an Express-compatible Lambda adapter for the existing Node.js backend            |
| Data           | DynamoDB on-demand, with college/club IDs on every record                                                           |
| Receipts       | Separate private S3 bucket; authorized, short-lived presigned uploads/downloads                                     |
| Login          | Cognito when moving from demo personas to real users; never publicly expose demo role switching with sensitive data |
| AI drafts      | Server proxy to OpenRouter using a free model; no provider key in React                                             |
| WhatsApp test  | Server calls Meta Cloud API directly with test phone-number ID/token and approved recipients                        |

Keep application resources in Mumbai (`ap-south-1`). CloudFront serves global assets; OpenRouter and Meta remain external services. Do not claim all user data stays in India when sending content to these services. Avoid always-on servers, NAT gateways, RDS, ALBs, and paid AI infrastructure for this stage.

CloudFront should use S3 Origin Access Control and a private REST origin. Rewrite extensionless React Router paths to `/index.html`, preserving asset errors. Prefer the default CloudFront hostname during the hackathon; add a custom domain later. Check the account's eligible CloudFront plan and AWS usage allowances rather than promising permanently free hosting. [AWS private S3 origin guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [CloudFront plan options](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html)

## Existing integrations to wire

The browser calls `/api/ai/draft` and `/api/notifications/send` locally through Vite's proxy, or `VITE_API_URL` when deployed. `VITE_API_URL` is public configuration; provider secrets stay in the server's local ignored environment file, then protected Lambda configuration or secret storage.

**OpenRouter:** configure `OPENROUTER_API_KEY` and the selected free model. Use `openrouter/free` or a verified `:free` model; prevent automatic fallback to paid models. Free access has quotas and variable availability. Keep drafts short, throttle per user/club, and fall back to the clearly labelled deterministic “Template draft” when unavailable. Always review generated names, dates, and claims before publishing. Only send organizer notes and necessary public event facts; do not send member lists or receipts. [OpenRouter free routing](https://openrouter.ai/discover), [OpenRouter limits](https://openrouter.ai/support/), [free-model selection guidance](https://openrouter.zendesk.com/hc/en-us/articles/51679572756123-I-used-openrouter-auto-free-or-auto-and-still-got-charged)

**Meta test account:** configure the server's WhatsApp access token, phone-number ID, API version, and a strict approved-recipient allowlist. Match the names in the server's `.env.example`. Add/verify the demo recipient in Meta's test setup; record that person's phone and explicit WhatsApp consent in their profile. Tokens may expire and must be refreshed by the account owner.

The first explicit test button sends the preapproved `hello_world` template. This verifies connectivity and **does not send the announcement body**. The UI/delivery detail must say so. Arbitrary announcement text requires a permitted active user-initiated messaging window, or a suitable approved template; the default test must not pretend to deliver custom content. Provider API acceptance is not proof of delivery. [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=folder-e5097869-a194-44db-89a9-936d994a5f9e), [Meta messaging policy](https://whatsappbusiness.com/policy/)

Automatic WhatsApp requires phone + opt-in, and consent must be rechecked immediately before sending. Honor withdrawal. Outside the customer service window, use approved templates. Test-account recipient restrictions remain in place; an AWS deployment does not remove them. Production Meta onboarding, templates, and billing are a later step. Email remains Prepared until an email provider is configured; use SES later if desired.

## Shared-data and access work

1. Cognito authenticates the real user; HTTP API verifies JWTs. Lambda then resolves server-owned college/club role records. Never trust a browser role, club ID, price, or finance permission. Keep the demo persona switcher only in a labelled isolated demo. [HTTP API JWT guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
2. Replace browser-local store operations with API calls progressively: memberships, ticket booking/check-in, expenses, stock/orders, announcements.
3. Use DynamoDB conditional transactions for last-seat booking, size stock decrement, one-time check-in, and pending-expense approval. A payment gateway remains separate; simulated payments must stay labelled.
4. Record actor, club, server timestamp, action, and changed record in append-only application audit history. This does not claim cryptographic tamper-proofing against cloud administrators.
5. Limit receipt type/size; scope signed object keys and short URL expiry; check finance/owner access on download.
6. Deduplicate send requests by announcement/channel/recipient. Treat uncertain provider timeouts carefully; do not blindly resend. Add signed provider webhook verification and status updates when demonstrating delivery receipts. A queue/DLQ and scheduled renewals can follow after the core demo is stable.

## Deployment sequence

1. Freeze the winning demo journey: join → member card → discounted ticket → QR check-in → volunteer expense → treasurer approval → college overview. Add one AI draft and one clearly labelled WhatsApp connectivity test.
2. Finish local validation using synthetic data; owner supplies secrets locally, never in chat or React.
3. Create S3/CloudFront, HTTP API/Lambda, and DynamoDB with SAM or CDK. Add Cognito before making sensitive real-user operations public. Use public URLs without purchasing a domain initially.
4. Configure server integrations and the frontend API URL. Deploy frontend build and server handlers. Test frontend deep links, sign-in, cross-club rejection, concurrent last-seat booking, duplicate scan, and retry behavior.
5. Owner initiates one consented Meta test and one OpenRouter draft from the UI; inspect results. Keep fallback/demo states clear if external accounts are unavailable.
6. Rehearse the three-minute presentation, then freeze features. Add no new infrastructure or feature families during the final rehearsal window.

Owner dependencies: AWS deployment access, OpenRouter key/free model, Meta test token + phone-number ID + approved recipient. No paid AI or AWS messaging intermediary is required for this approach. AWS still bills metered hosting/backend usage outside eligible allowances; use account budgets and service throttles, and avoid a promise of zero cost.
