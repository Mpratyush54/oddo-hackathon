# Skyline Student Association

React + TypeScript frontend with a custom Node.js/Express backend written in standard .js files.

Live AWS deployment: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com

## Run locally

    npm install
    npm run dev

Open http://127.0.0.1:5174. The command starts the full JWT backend on port 3001 and Vite with its API proxy. Local backend records use memory and reset when it restarts. Provider settings load from the ignored .env file. The local JWT signing key is generated at startup unless JWT_SECRET is set.

    npm run dev:demo

This preserves the original labelled persona/localStorage demonstration and its separate integration API. Demo personas are unavailable in the AWS build.

    npm run test:api
    npm run build

## Deploy on AWS

    npm run deploy:aws -- --api-hosting

This builds the Express Lambda and frontend, provisions/updates CloudFormation in Mumbai, stores JWT/provider secrets in Secrets Manager, and initializes public club fixtures only when they do not exist. Existing business data survives redeployment. Resource identifiers are saved in the ignored AWS_DEPLOYMENT_OUTPUT.json file.

The AWS account currently blocks CloudFront creation pending account verification. The working deployment therefore serves both static files and /api through API Gateway HTTP API + Lambda. It uses DynamoDB on-demand and private S3 receipts. Frontend build artifacts are also saved in private S3. See AWS_DEPLOYMENT_PLAN.md for the account limitation and rollout details.

API Gateway hosting is the deployment script's default. Use `node scripts/deploy-aws.js --cloudfront` only after AWS verifies the account for CloudFront.

## Automatic GitHub deployments

The `.github/workflows/deploy-aws.yml` workflow tests and builds pull requests. Every push to `main` in `Mpratyush54/oddo-hackathon` tests, builds, and deploys the Express backend and React frontend to the existing AWS stack, then checks the live website and JWT backend health. It can also be run manually from GitHub Actions.

AWS OIDC trusts only this repository's `main` branch. The role can read this stack's outputs, update this Lambda's code, and upload to the existing private artifact/frontend buckets. It has no direct secret-read, database-write or IAM permissions. AWS credentials are temporary; provider credentials and JWT keys remain in Secrets Manager. [GitHub's AWS OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

The repository variables `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `AWS_STACK_NAME`, and `AWS_ARTIFACT_BUCKET` are already configured. The workflow pins official actions to verified commit hashes. Deployments run serially. Infrastructure changes and new club initialization use the local `npm run deploy:aws` command; automatic code deployments preserve existing accounts, memberships, secrets and receipts.

`node scripts/setup-github-deploy.js` recreates or updates the OIDC role and repository variables using authorized local AWS and GitHub credentials.

## Accounts and permissions

Signup/login use our own Express routes, scrypt password hashes, HS256 JWT access tokens lasting 15 minutes, and rotating refresh tokens lasting seven days. Cookies are HttpOnly, Secure in AWS, and SameSite=Lax. JWTs validate signature, algorithm, issuer, audience and expiry; DynamoDB session/profile records enforce revocation. Logout revokes the session; changing a password revokes other sessions. Refresh-token reuse revokes the associated account session version. The web client supplies a CSRF token and client header on authenticated changes.

All new accounts start with student permissions. Roles come from server-owned per-club records and cannot be selected in the production browser. The initial account mpratyush54@gmail.com has the Skyline admin role. Grant subsequent access from an authorized local AWS session after the intended account signs up:

    node scripts/grant-role.js mpratyush54@gmail.com skyline admin

This initial administrator also has active complimentary Skyline membership through 31 July 2027, granted with `node scripts/activate-membership.js mpratyush54@gmail.com skyline`. The grant records an audit event and does not record a payment.

Other roles are member, organizer, treasurer and college. Club IDs are skyline, codecraft and canvas. A college assignment grants aggregate campus overview access, rather than individual finance records. Never grant staff access merely because someone typed a matching email: email ownership verification and email-based password recovery are not configured in this pilot.

## Shared backend

The backend owns memberships, WhatsApp consent, prices, tickets/check-in, merchandise stock/orders, promo codes, points, waitlists, tasks, announcements, prepared reminders, expenses/approvals, college summaries, and audit events. The cloud client never supplies commerce snapshots or actor identities. Sensitive reads are filtered by user and per-club role.

Club mutations use optimistic version checks in DynamoDB transactions together with a separate audit event and a per-user request record. This protects last-seat/stock changes, duplicate scans, approvals, and repeat requests. Mutation clients must reuse their idempotencyKey after an uncertain response; keys are retained for 24 hours. WhatsApp deduplication records have no TTL and persist across restarts. The pilot stores one aggregate per club, capped at 300 KB; large deployments should move business entities to individual records.

Receipts allow PDF/JPEG/PNG, up to 5 MB, with five-minute presigned uploads and two-minute authorized downloads. They are private, scoped to user + club, and checked for object existence/type/size before an expense is accepted. Another finance reviewer must approve an expense.

Payments remain explicitly simulated; the backend does not charge money or verify gateway payments.

## Provider settings

Keep all provider secrets in .env locally and Secrets Manager in AWS. No secret may use a VITE_ prefix.

- OPENROUTER_API_KEY; OPENROUTER_MODEL defaults to openrouter/free. Only free models are accepted. AI_DAILY_LIMIT controls a persistent club quota. Drafts use organizer notes/public facts and stay editable.
- META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID, META_GRAPH_VERSION, META_TEST_RECIPIENTS configure the direct Meta test API.
- META_WHATSAPP_TEMPLATE must be hello_world and META_TEMPLATE_PARAMETER_COUNT must be 0 for this endpoint.
- META_APP_SECRET authenticates webhook signatures. It was not present at deployment, so signed delivery processing remains unavailable until supplied.
- META_WEBHOOK_VERIFY_TOKEN is generated in Secrets Manager if omitted. Copy that value into Meta's webhook configuration, rather than putting it in the browser.
- VITE_API_URL is public configuration; the deployed app uses /api.
- VITE_BACKEND_MODE=aws enables authenticated shared-data flows.

WhatsApp is sent only by the explicit test button, after server-side consent and allowlist checks. hello_world is a connectivity test and does not send announcement content. Meta acceptance is not device delivery. Uncertain timeouts are marked Unknown and blocked from automatic resend. The webhook URL is:

    https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/webhooks/whatsapp

Email is prepared only; no email provider or automated delivery schedule is configured.

## Validation

API tests cover JWT/CSRF/session rotation and revocation, role isolation, concurrency, authoritative pricing, waitlist offers, private data filtering, expense review, and persistent WhatsApp timeout deduplication/signatures.

    node scripts/backend-smoke.cjs

The AWS/browser smoke test creates a synthetic account, validates signup/login, joining, an idempotent booking, a private receipt upload and expense, and session refresh/logout. It removes only its synthetic account/business records/receipt afterward, retaining the audit history. The Playwright package location can be overridden with PLAYWRIGHT_MODULE. It sends no WhatsApp messages and makes no AI requests.
