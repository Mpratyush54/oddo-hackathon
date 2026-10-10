# Project architecture

The frontend is React + TypeScript. The backend is Node.js + Express in standard `.js` files with custom JWT authentication. The root package installs dependencies and orchestrates both applications; `frontend/` and `backend/` are separate source trees.

```text
frontend/
  index.html, vite.config.ts, tsconfig.json
  public/                         Static assets
  src/
    main.tsx                      Browser entry point
    app/                          Router, authenticated layout, shared state
    features/                     Account, auth, clubs, events, tickets, commerce,
                                  membership, finance, communications, college, shop
      <feature>/pages/            Route screens
      <feature>/components/       Feature UI
      <feature>/api/              Feature API calls
    shared/                       Domain types, API client, UI, layouts, utilities
    demo/data/                    Clearly isolated demo fixtures
backend/
  src/
    app.js                        Express composition and middleware ordering
    entrypoints/                  Local server and AWS Lambda adapter
    config/                       Environment loading
    middleware/                   Origin checks, JSON shape, auth/CSRF, errors
    modules/
      auth/                       Controllers, routes, JWT/session service, passwords
      clubs/                      State access, transaction orchestration, views, dispatcher
      <feature>/                  Controllers, request schemas and feature service classes
    database/
      schemas/                    Runtime record and business entity contracts
      repositories/               DynamoDB adapter and memory test/local adapter
    shared/                       Authorization, validation, IDs, dates, key helpers
  database/schema.json            Generated JSON Schema
  data/seed.json                  Public catalog fixtures only
  tests/unit/, tests/integration/  Storage/domain and HTTP integration tests
  demo/                           Original local persona integration API
infra/                            CloudFormation definitions
shared/                           Zod formats used by frontend and backend
scripts/                          Build, AWS deployment, owner administration, validation
.github/workflows/                Tests and automatic main-branch AWS deployment
```

HTTP routes keep their existing URLs. Controllers translate HTTP requests into service calls. Services derive identity/roles/prices from authoritative records. Repositories own DynamoDB operations and validate every complete record before writing. Business action modules return a proposed state; the club service commits it with optimistic version checks, an audit record and an idempotency record in one transaction.

Each action creates a fresh feature service instance. `clubs/actions.js` maps action names to explicit methods instead of using combined switch handlers. The feature classes are `MembershipService`, `AccountService`, `TicketService`, `CommerceService`, `FinanceService`, `AnnouncementService`, `EventService`, and `TaskService`. For example, `FinanceService` exposes `createExpense`, `reviewExpense`, and `createIncome`. Commerce calculations live separately in `commerce.domain.js` so the authenticated services and demo API share them.

Each feature keeps its input contracts in `<feature>.schemas.js`. `parseRequest` uses Zod to return normalized inputs or an HTTP 400 with field-level `details`. Unknown input properties are removed; users, roles, prices and reviewer identities come from server context. Expense reviews use a discriminated union: approval requires a transaction ID, while rejection also requires a nonempty reason. Stored-state checks such as receipt ownership, another treasurer reviewing the expense, and booking capacity remain in the service methods.

Authored application code uses Zod's built-in email, phone, date/time and hash formats, together with readable string operations and character lists. The shared formats live in root `shared/schemas.js` with TypeScript declarations for the frontend. Zod's generated JSON Schema includes its own format patterns; editing those generated expressions is unnecessary.

JWT session handling and password hashing are separated from HTTP handlers. OpenRouter has a dedicated service; the production backend does not import the demo router. S3 receipt verification has a dedicated service. Feature pages and shared components no longer live in the former combined Portal, Commerce or components files. StoreProvider contains state coordination; types, formatting helpers and fixtures live separately.

Use `npm run dev` for the local authenticated app, `npm run dev:demo` for the persona demo, `npm test` for backend/event-time/schema checks, and `npm run build` for the frontend. `npm run db:schema` updates the generated contract after changing schemas. See [DATABASE.md](DATABASE.md) for database design and [the deployment plan](../AWS_DEPLOYMENT_PLAN.md) for AWS setup.
