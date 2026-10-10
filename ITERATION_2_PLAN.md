# Skyline — iteration two and hackathon finish plan

Updated 10 October 2026. Preserve the supplied teal workspace and gold public visual system; deliver one coherent student-organization story across members, events, tasks, merchandise, money, and communications.

## Implemented iteration

- Public landing at `/`, discovery at `/clubs`, club pages, shareable event details, and demo entry.
- Working profile/organization menus, independently scrolling sidebar navigation, three scoped club datasets, and responsive workspace.
- Five labelled demo personas with different dashboard priorities and permitted UI actions: student/volunteer, organizer, treasurer, club administrator, college administrator.
- Personal membership card/QR, bookings/orders, consent preferences, capacity-aware ticketing/check-in, waitlist, inventory, tasks, and announcements.
- Treasurer review/approval/rejection, receipts, event budget/actual, attention items, and application audit history.
- Communications audience composer, feed, prepared channel jobs, consent counts, reminder deduplication, delivery log, and reviewed draft assistant.

These are local demo capabilities. Persona switching is an intentional judging tool, not authentication. Data remains in browser localStorage; there is no deployed shared database or production role enforcement. Payments remain simulated.

## Current integration choice

Use the existing **OpenRouter free access** for notes-to-announcement drafts, and the existing **Meta WhatsApp test account directly** for explicit test messages. Provider keys stay in the local server's ignored `.env`, then in protected backend configuration when deployed. No paid AI infrastructure or messaging intermediary is needed.

`npm run dev` starts the local Express/Node.js API and React frontend at port 5174. The browser calls `/api/ai/draft`, `/api/notifications/send`, and `/api/health`. See README and `.env.example` for settings.

The AI assistant produces an editable draft. A free-service failure falls back to an honestly labelled template. It never publishes, approves money, or sends automatically. The default WhatsApp action sends Meta's hello_world connectivity template only; it must not claim that the custom announcement body was delivered. Recipient phone + opt-in + server test allowlist are required. Email and automatic renewal delivery stay prepared until implemented.

## Finish in this order

1. Validate all role dashboards, profile and club switching, short-height sidebar reachability, mobile layouts, and public entry paths.
2. Rehearse the connected core with synthetic data: membership → discounted ticket → QR verification/check-in → expense → treasurer approval → college summary.
3. Owner configures OpenRouter and Meta locally. Demonstrate one reviewed draft and one explicitly consented test template. Keep template/provider failure states ready as a backup.
4. Deploy the simple AWS stack if time and account access allow: S3/CloudFront, HTTP API/Lambda with an Express-compatible adapter, DynamoDB; Cognito before public real-user access. Follow [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md).
5. Freeze new features, fix only demonstrated defects, run build and API tests, and rehearse the presentation and backup demo.

Do not imply AWS, Cognito, shared persistence, real payments, or outbound email are live until they are implemented and verified. Keep General AI chat, OCR, offline scan synchronization, leaderboards, and additional infrastructure outside this submission's feature freeze.

## Three-minute demo story

| Moment                  | Show                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public welcome          | Discover Skyline and enter the labelled demo                                                                 |
| Student                 | Membership card, member price, ticket and personal task                                                      |
| Organizer               | Event readiness, QR check-in, duplicate scan feedback                                                        |
| Volunteer/treasurer     | Receipt request, review, approve/reject, resulting ledger/audit                                              |
| Club/college leadership | Club alerts and cross-club participation overview                                                            |
| Communications          | Turn bullets into a reviewed OpenRouter draft; show consent targeting and explicit Meta test template action |

Close with one honest boundary sentence: the campus workflow is a functioning local prototype, with provider integrations configurable and a simple AWS deployment path. Do not inflate a connectivity test into proof of production messaging.
