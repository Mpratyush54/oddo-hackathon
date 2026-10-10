# Skyline Student Association

A React + TypeScript campus club platform with React Router, Vite, QR tickets, and a readable local Express/Node.js API for OpenRouter drafts and Meta WhatsApp tests.

## Run locally

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5174/. This command starts both the frontend and the local API (port 3001). Vite proxies `/api` to that API. If 5174 is already occupied, use the frontend URL printed in the terminal.

```sh
npm run build
npm run test:api
```

`npm run preview` previews the static production build; it does not start the integration API. For integration development, use `npm run dev` or start `npm run dev:api` separately. Camera scanning requires permission and localhost or HTTPS.

## Current product

- Public landing, club discovery, club profiles, and shareable event pages.
- Working organization switcher with three independent club datasets, profile menu, and scrolling navigation.
- Five labelled demo personas: student/volunteer, organizer, treasurer, club administrator, and college administrator. Each sees relevant navigation, actions, and dashboard priorities.
- Personal membership card, QR verification, bookings/orders, and WhatsApp consent.
- Event capacity, member pricing, ticket checkout/check-in, duplicate scan feedback, and waitlists.
- Merchandise sizes/stock, task planning, event budget/actual reporting, expense receipts, approvals/rejection, and local audit history.
- Communications with audience targeting, in-app publication, consent-aware WhatsApp preparation, delivery records, reminders, and editable AI/template drafts.

## Optional provider setup

Copy `.env.example` to a local `.env`, then set only the integrations you want to demonstrate. Restart `npm run dev` after changing server credentials. Do not paste keys into the app or commit them.

| Setting                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `OPENROUTER_API_KEY`                 | Server-only OpenRouter key                               |
| `OPENROUTER_MODEL=openrouter/free`   | Free router; a selected `:free` model is also permitted  |
| `AI_DAILY_LIMIT=30`                  | Local server draft limit; provider quotas also apply     |
| `META_WHATSAPP_TOKEN`                | Server-only Meta test access token                       |
| `META_PHONE_NUMBER_ID`               | Meta test sender phone-number ID                         |
| `META_GRAPH_VERSION`                 | Use the version shown in your Meta API setup             |
| `META_TEST_RECIPIENTS`               | Comma-separated approved test numbers with country code  |
| `META_WHATSAPP_TEMPLATE=hello_world` | Preapproved connectivity test template                   |
| `META_TEMPLATE_LANGUAGE=en_US`       | Template language                                        |
| `META_TEMPLATE_PARAMETER_COUNT=0`    | No custom body parameters for hello_world                |
| `API_PORT=3001`                      | Local integration API port                               |
| `VITE_API_URL=/api`                  | Public API URL only; no secrets in any `VITE_*` variable |

OpenRouter free access can be unavailable or rate-limited. Successful AI drafts are labelled OpenRouter; deterministic fallback is labelled Template draft. Drafts remain editable and do not publish automatically. The server refuses paid model names.

For WhatsApp, add and verify the recipient in Meta's test setup. Record that person's actual phone and explicit opt-in in their profile. Publish an announcement with WhatsApp selected, then explicitly click **Send WhatsApp test template**. Every selected recipient must be in the server allowlist; use an audience containing only your approved demo recipients. The default hello_world test verifies connectivity and **does not deliver your announcement body**. Provider acceptance is not device delivery confirmation. Manual WhatsApp sharing is a separate human action. Email remains prepared until a provider is added. No messages are sent just by starting the app.

## Demo and production boundaries

Business data persists in this browser under `skyline-v2`; session/persona selection uses `skyline-session`. There is no shared database or real account authentication yet. Demo roles govern UI actions, but localStorage can be edited and these controls are not a production security boundary. The local Express API is a loopback demo service, not a public authenticated backend. Its counters and send deduplication live in memory and reset when the server restarts. Verify the provider dashboard before retrying an uncertain send.

Payments are simulated. Receipts and audit history are local demonstration records. No AWS infrastructure, Cognito authentication, production WhatsApp, shared DynamoDB persistence, email delivery, or payment provider has been deployed. Event photos/fonts may require internet access. The sample semester is anchored to 10 October 2026.

To reset the demo, clear `skyline-v2` and `skyline-session` from this site's browser storage and reload; this discards local demo changes. Production hosting must support React Router deep links.

See [ITERATION_2_PLAN.md](ITERATION_2_PLAN.md) for the current scope/demo story and [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md) for the concise AWS rollout using direct Meta and OpenRouter.
