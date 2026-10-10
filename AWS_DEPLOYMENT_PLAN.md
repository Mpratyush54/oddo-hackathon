# Skyline AWS deployment: implementation and current status

Updated 11 October 2026.

## Decisions applied

The backend is our own Node.js/Express application in .js files. Authentication is fully custom JWT authentication; Cognito is not used. The React frontend is connected to authenticated APIs and shared DynamoDB data. The original persona demo remains available locally through npm run dev:demo.

The codebase now has separate feature-organized `frontend/` and `backend/` trees. Backend routes/controllers, JWT/password services, business action modules, repositories and runtime database schemas have distinct responsibilities. Database records are validated before writes; the generated contract is `backend/database/schema.json`. See [architecture](docs/ARCHITECTURE.md) and [database schema](docs/DATABASE.md). Automatic GitHub deployments run schema consistency/fixture checks alongside API tests and the frontend build.

## Live deployment

Website and API base: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com

Health: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/health

CloudFormation stack: skyline-campus-api in ap-south-1.

| Part                     | Deployed choice                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| HTTPS frontend and API   | API Gateway HTTP API + Node.js 22 Lambda with the Express adapter                                     |
| Accounts                 | Express signup/login, scrypt password hashing, signed JWT access cookies and rotating refresh cookies |
| Data                     | DynamoDB on-demand, encrypted, with point-in-time recovery and TTL for sessions/request counters      |
| Receipts                 | Separate private encrypted S3 bucket with scoped presigned uploads/downloads                          |
| Provider/JWT credentials | Secrets Manager, accessible to the Lambda role                                                        |
| Frontend build archive   | Private encrypted S3 bucket                                                                           |
| Logging                  | CloudWatch Lambda logs, 14-day retention                                                              |
| AI                       | Direct OpenRouter free-model calls from Express                                                       |
| WhatsApp                 | Direct Meta hello_world connectivity tests, consent and test-recipient allowlist enforced             |

No always-on instance, NAT gateway, RDS, ALB, paid AI fallback or AWS messaging intermediary is required. AWS services still have metered costs; this is not a promise of free hosting.

## CloudFront account limitation

The attempted CloudFront distribution was rejected by AWS: the account must be verified before new CloudFront resources can be created. AWS directed the account owner to contact AWS Support and include that error.

The live API Gateway/Lambda hosting path is the operational fallback. Both the website and /api use the same HTTPS origin, so secure cookies work without cross-origin browser configuration. Static files are bundled into the Lambda package; this is practical for the pilot but less efficient than CloudFront at high traffic. The private S3/CloudFront OAC template is retained in infra/template.js for use once AWS verifies the account.

The empty DynamoDB table and S3 buckets retained by the failed initial stack were checked and removed. The failed stack was removed. Code artifact staging/secret storage are private.

AWS references: [Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html), [private S3 origins with OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## Security and shared data

- Access tokens expire after 15 minutes; refresh tokens after seven days. Cookies are HttpOnly, Secure in AWS and SameSite=Lax. Signatures, algorithm, audience, issuer and expiration are verified on every access.
- DynamoDB session and account version checks enforce logout, password-change revocation and refresh-token reuse detection.
- CSRF tokens, a required custom client header, origin checks and persistent user/IP quotas protect changes. Tokens are never saved in browser localStorage.
- Signup assigns student access. Per-club staff role records are owned by the server/AWS administrator. UI role switching and browser snapshots are rejected in AWS.
- Student reads include their own membership, tickets, orders, requests and points; finance data and receipts require owner/finance permissions. College access returns aggregate summaries.
- Each club mutation atomically writes its new version, an audit event, and a per-user idempotency result. Concurrent seat/stock changes, duplicate check-ins and repeated approvals cannot overwrite each other.
- The low-volume pilot uses a club aggregate with a 300 KB ceiling. Audit events persist separately; the state contains only a recent audit view. Move entity families to individual DynamoDB records before large-scale use.
- Receipt uploads last five minutes, allow PDF/JPEG/PNG and 1 byte–5 MB, and use user/club-scoped keys. Submission checks S3 metadata. Downloads require authorization and expire after two minutes.
- Razorpay TEST mode connects tickets, merchandise and annual membership. Server signatures and captured payment checks guard fulfillment. Live keys are rejected. See [payment setup and limits](docs/PAYMENTS.md).

Application audit history is append-only through the application API; it does not claim cryptographic tamper-proofing against cloud administrators.

## Provider behavior

OpenRouter credentials from the ignored .env are stored in Secrets Manager. Only openrouter/free or a selected :free model is accepted, with a persistent daily club quota. Failed AI requests retain the editable, labelled template fallback. Member lists and receipts are not sent to the model. [OpenRouter API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request?explorer=true), [free router](https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/routers/free-router.mdx).

WhatsApp credentials and approved recipients are configured. The explicit test button uses hello_world only: it tests connectivity and does not send an announcement's body. Server-owned opt-in is rechecked immediately before the call. Accepted requests, confirmed webhook statuses, rejected calls and uncertain timeouts remain distinct in the delivery detail. Durable deduplication prevents automatic resends across Lambda restarts.

Signed webhook handling is implemented, but META_APP_SECRET was absent. Add the real Meta app secret to .env and redeploy before configuring delivery status webhooks. Retrieve META_WEBHOOK_VERIFY_TOKEN from the backend Secrets Manager secret and enter it in Meta's setup. Do not expose either value in React or chat. [Meta webhook signature verification](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).

Webhook URL: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/webhooks/whatsapp

No WhatsApp messages or AI generations were sent as part of deployment verification. Email and reminder delivery remain Prepared until an email provider/scheduler is connected. OpenRouter and Meta are external services; hosting in Mumbai does not imply all provider-processed content stays in India.

## Deployment and administrator setup

    npm install
    npm run test:api
    npm run deploy:aws -- --api-hosting

The script builds and packages the backend/frontend, stores server secrets securely, applies CloudFormation, and initializes public fixture clubs only when absent. It preserves existing DynamoDB state. AWS_DEPLOYMENT_OUTPUT.json contains resource identifiers and is ignored by Git.

The initial Skyline administrator account, mpratyush54@gmail.com, registered and received the admin role on 10 October 2026. Reload the workspace after role changes. An authorized AWS session can grant roles with:

    node scripts/grant-role.js mpratyush54@gmail.com skyline admin

The same account has active complimentary Skyline membership expiring 31 July 2027. The AWS CLI grant created its enrollment and audit event atomically without claiming a payment. The generic AWS save toast has been replaced with contextual membership/preferences messages.

Fresh accounts cannot self-select staff roles. Email verification and email-based password recovery are not configured; verify the intended staff member before granting privilege. Add a verified mail sender and those account recovery flows before onboarding real campus users.

## GitHub push deployments

Repository: [Mpratyush54/oddo-hackathon](https://github.com/Mpratyush54/oddo-hackathon). The workflow in `.github/workflows/deploy-aws.yml` checks pull requests and deploys pushes to main. Tests and the TypeScript/Vite build must pass before deployment; the deploy job builds the Express Lambda package, uploads it to the existing private artifact bucket, updates Lambda with a revision guard, waits for success, archives the frontend in private S3, and checks the live website/backend.

The `skyline-campus-api-github-deploy` IAM role trusts GitHub OIDC only for this repository and refs/heads/main. Repository variables are configured. Only the deployment job receives temporary credentials. Role permissions are scoped to existing stack outputs, the one backend function and its artifact/frontend buckets; direct provider-secret reads, database writes and IAM changes are excluded. Provider/JWT secrets and persistent data survive code deployments. [AWS role trust guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html), [GitHub AWS OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

Code deployments use scripts/deploy-existing.js. Infrastructure updates and new club initialization use scripts/deploy-aws.js locally. API Gateway hosting is now the default; CloudFront requires an explicit --cloudfront option after account verification. The latest CLI attempt was also rejected with the same AWS account-verification error.

## Verification and next dependencies

Unit/integration tests cover custom JWT sessions, CSRF, refresh rotation/reuse, logout/password revocation, club-role isolation, last-seat/stock concurrency, waitlist reservations, duplicate scans, expense review, and provider signature/deduplication behavior. The production build passes.

Business actions now use eight feature service classes with named methods instead of combined switch handlers. Feature request schemas use Zod; shared phone, promo, hash and identifier formats live in `shared/`. Additional regression tests verify field-level HTTP errors, rejection reasons, reviewer identity, independent parallel request state, and no database writes for invalid payloads. See [the architecture](docs/ARCHITECTURE.md) and [database contract](docs/DATABASE.md).

Live AWS/browser verification passed signup/login, joining a club, server-priced booking and duplicate retry, ticket display, private receipt upload and expense submission, refresh, and logout. Browser runtime errors were empty; synthetic QA account/data/receipt were removed while retaining audit events.

Remaining owner dependencies: Meta app secret/webhook setup and one explicit consented test from the UI; AWS account verification for CloudFront; a verified email sender/recovery workflow before real-user rollout. Razorpay test payment integration is implemented; production WhatsApp onboarding and live payment processing are not enabled.
