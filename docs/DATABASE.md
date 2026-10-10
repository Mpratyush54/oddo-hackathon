# Database schema — version 1

Skyline uses one AWS DynamoDB on-demand table with string partition key `pk`, string sort key `sk`, and TTL attribute `expiresAt` (Unix seconds). Infrastructure is declared in `infra/template.js`. Record schemas are declared in `backend/src/database/schemas/`; the generated, standard JSON Schema is `backend/database/schema.json`. This is an explicit application schema for the existing DynamoDB database.

Every repository `put`, `atomic`, and business `commit` validates records before sending a write. A transaction validates every item before writing any item. The DynamoDB rate counter uses a constrained atomic numeric update; its arguments are validated separately. New full-record writes add `schemaVersion: 1`. Existing records without that attribute are valid version 1 input. No destructive migration is needed. Unknown fields and record kinds are rejected; schema changes must declare their fields.

## Table records and access patterns

| Record             | `pk`                                 | `sk`                     | Required contents / purpose                                                                   |
| ------------------ | ------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| Account credential | `ACCOUNT#<sha256(normalized email)>` | `ACCOUNT`                | User `id`, encoded scrypt password hash; unique login lookup                                  |
| User profile       | `USER#<id>`                          | `PROFILE`                | `id`, name, email, emailVerified, sessionVersion, createdAt; optional disabled flag           |
| Club access        | `USER#<id>`                          | `ACCESS#<clubId>`        | Matching clubId, role, optional collegeId; query all assignments for a user                   |
| Access session     | `SESSION#<sessionId>`                | `SESSION`                | userId, sessionVersion, 64-character CSRF token, revoked, expiresAt                           |
| Refresh token      | `REFRESH#<sha256(token)>`            | `REFRESH`                | userId, sessionId, revoked, expiresAt; opaque token stored only as a hash                     |
| Rate counter       | `LIMIT#<scope>#<time window>`        | `COUNT`                  | Integer count and expiresAt; atomic quota enforcement                                         |
| Club aggregate     | `COLLEGE#<collegeId>#CLUB#<clubId>`  | `STATE`                  | Integer version and structured `data` below                                                   |
| Immutable audit    | Same club partition                  | `AUDIT#<timestamp>#<id>` | actor, action, date, detail; optional entity/entityId and club identifiers                    |
| Idempotent request | Same club partition                  | `REQUEST#<userId>#<key>` | SHA-256 action fingerprint, JSON result, expiresAt; 24-hour retention                         |
| WhatsApp delivery  | Same club partition                  | `DELIVERY#<hash>`        | Announcement, channel, recipient, status, detail and provider metadata; durable deduplication |
| Provider mapping   | `MESSAGE#<providerMessageId>`        | `DELIVERY`               | deliveryPk and deliverySk linking back to the delivery ledger                                 |
| Provider status    | Same message partition               | `STATUS`                 | sent/delivered/read/failed, numeric providerTimestamp; handles early webhooks                 |

Roles are `member`, `organizer`, `treasurer`, `admin`, or `college`. ACCESS records are written by authorized owner tooling; the browser cannot grant roles. Profile keys must match the stored user identity and access keys must match clubId. TTL deletion is asynchronous, so session and refresh expiry are checked in application code before acceptance. Request fingerprint checks prevent reuse of a key for another action.

## Club aggregate entities

Browser device subscriptions use `USER#<userId>` / `PUSH#<endpointHash>` with an active flag, version, timestamps and a validated endpoint/key pair. `PUSH#<endpointHash>` / `OWNER` conditionally binds that device to one account. Automatic reminder markers use the club partition / `REMINDER#<notificationId>` with userId, timestamp and 90-day TTL. They prevent duplicates even if old aggregate notifications are later archived. Delivery ledgers also support Browser, queue content, reminder references and conditional versions. Meta STATUS rows carry an optional version for safe concurrent webhook reconciliation. Private push endpoint keys never appear in member-facing club delivery logs.

| Collection    | Schema and relationships                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| members       | Unique id; optional userId links PROFILE; name/email/course, status Active/Pending/Expiring/Expired, joined/expires dates, member role, consent, preferences, points and optional complimentary enrollment metadata |
| events        | Unique id; schedule, capacity, sold, public/member prices and optional venue/media/budget; sold cannot exceed capacity                                                                                              |
| products      | Unique id; name/type/prices and a size→nonnegative integer stock map                                                                                                                                                |
| tickets       | Unique id; eventId links events, optional userId links PROFILE; attendee, nonnegative amount, membership/check-in flags and Confirmed/Cancelled status                                                              |
| orders        | Unique id; productId links products, optional userId links PROFILE; size, nonnegative amount, date and optional promo                                                                                               |
| transactions  | Unique id; signed amount (negative expense/credit, positive income), category/date, Completed/Pending/Rejected; optional eventId, owner/reviewer and private receiptKey                                             |
| tasks         | Unique id; title, description, assignee, optional assigneeId, due date, Low/Medium/High priority and To do/In progress/Done status                                                                                  |
| promos        | Unique id; code, percent/fixed type, value, active flag, redemptions and optional limits; percentage cannot exceed 100                                                                                              |
| pointLedger   | Unique id; memberId links members, participation/volunteer/contribution kind, integer points, reason and optional event/order/task reference                                                                        |
| announcements | Unique id; title/body, audience, author, read count, date and delivery selections                                                                                                                                   |
| notifications | Unique id; title/body/date, read flag, target and optional audience/userId                                                                                                                                          |
| deliveries    | Prepared delivery rows; announcement reference, channel, recipient, status/date/detail; actual provider outcomes also have durable standalone ledger records                                                        |
| waitlist      | Unique id; eventId, attendee/email, joined timestamp and Waiting/Promoted/Booked status                                                                                                                             |
| eventReviews  | Optional collection; eventId, authorId/name, 1–5 rating, comment and date                                                                                                                                           |
| audit         | Latest audit history displayed in the UI; immutable standalone audit records are retained separately                                                                                                                |

The schemas enforce field types, supported enums, valid date/time shapes, nonnegative inventory/prices, finite transaction amounts, unique IDs within each collection, and the capacity/discount invariants. Services enforce relationships, ownership, booking availability and review permissions. These are application relationships, not DynamoDB foreign-key constraints. Receipt files are private S3 objects, referenced by transaction.receiptKey; file bytes are not stored in DynamoDB.

HTTP input schemas are separate from these persistence schemas. Each feature declares accepted commands in `backend/src/modules/<feature>/<feature>.schemas.js`; its service parses input before changing state. For example, `finance.schemas.js` requires a positive expense amount and a rejection reason when status is `Rejected`. `FinanceService` then verifies the current transaction is a pending expense owned by another user. Repositories validate the resulting complete record before committing. Failed input or business checks leave state, audit and idempotency records unchanged.

A business update commits STATE with `version = previous + 1`, an immutable AUDIT row and a REQUEST row in a single DynamoDB transaction. A version condition prevents lost updates; unique audit/request conditions prevent duplicate writes. Conflicts retry from current data. Validation failures issue no writes.

The current pilot stores business entities inside one aggregate per club and caps its JSON payload at 300 KB before the DynamoDB item limit. Large clubs require a future schema migration to individual entity records; this refactor preserves the running application's aggregate transaction model and existing data.

## Inspect and validate

Refund requests use the club partition and `REFUND#<providerPaymentId>` sort key. The strict Zod record includes the payment owner and record keys, server-owned INR amount, test mode, reason, version, reviewer, provider reference, status and optional membership lock snapshot. Records have no TTL. Approval and provider reconciliation atomically update STATE, PAYMENT, REFUND and an immutable AUDIT row; approval also conditionally checks the current reviewer's club role. Tickets/orders carry `refundPending`; memberships also retain the payment that activated them. Point refunds retain the original entry and append a negative reversal for an auditable net total.

```sh
npm run db:schema                # Generate the JSON contract from runtime schemas
npm run db:schema:check          # Detect a stale generated schema
npm run db:validate              # Validate public fixtures
npm run db:validate -- --live     # Read-only validation of deployed DynamoDB records
npm test                        # Schema rejection, transaction safety and API tests
```

Live validation requires the existing AWS CLI login and ignored AWS_DEPLOYMENT_OUTPUT.json. It reports record counts and invalid field paths without printing credentials or record values. To evolve the contract, add the declared fields, update tests, regenerate schema.json, validate existing records, then deploy. Breaking schema changes need an explicit migration and version upgrade rather than bypassing validation.

Sources: [DynamoDB core components](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html), [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transactions.html), [Zod schema parsing](https://zod.dev/basics), [Zod JSON Schema export](https://zod.dev/json-schema).

Email proof uses EMAIL_VERIFICATION records under VERIFY#<SHA-256 token>, with userId, email, revoked and expiresAt. The runtime Zod schema and generated JSON Schema include this record kind. Tokens are never returned by an API or persisted in plaintext. DynamoDB TTL cleans expired records; confirmation checks expiry independently of TTL cleanup.

## Razorpay test payment records

`USER#userId / PAYMENT#requestKey` stores a versioned test-only checkout with server-calculated INR paise, its action, captured payment/order IDs and fulfillment result. `RAZORPAY#orderId / PAYMENT_REF` maps signed webhooks to the owner. Both are declared in `payment.schema.js` and have no TTL. Fulfillment updates the payment record atomically with STATE, AUDIT and REQUEST. New ticket/order/transaction rows declare optional `paymentId`. See [payment behavior](PAYMENTS.md).
