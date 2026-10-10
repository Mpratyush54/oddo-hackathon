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
      <feature>/                  Routes/controllers and business action services
    database/
      schemas/                    Runtime record and business entity contracts
      repositories/               DynamoDB adapter and memory test/local adapter
    shared/                       Authorization, validation, IDs, dates, key helpers
  database/schema.json            Generated JSON Schema
  data/seed.json                  Public catalog fixtures only
  tests/unit/, tests/integration/  Storage/domain and HTTP integration tests
  demo/                           Original local persona integration API
infra/                            CloudFormation definitions
scripts/                          Build, AWS deployment, owner administration, validation
.github/workflows/                Tests and automatic main-branch AWS deployment
```

HTTP routes keep their existing URLs. Controllers translate HTTP requests into service calls. Services derive identity/roles/prices from authoritative records. Repositories own DynamoDB operations and validate every complete record before writing. Business action modules return a proposed state; the club service commits it with optimistic version checks, an audit record and an idempotency record in one transaction.

JWT session handling and password hashing are separated from HTTP handlers. OpenRouter has a dedicated service; the production backend does not import the demo router. S3 receipt verification has a dedicated service. Feature pages and shared components no longer live in the former combined Portal, Commerce or components files. StoreProvider contains state coordination; types, formatting helpers and fixtures live separately.

Use `npm run dev` for the local authenticated app, `npm run dev:demo` for the persona demo, `npm test` for backend/event-time/schema checks, and `npm run build` for the frontend. `npm run db:schema` updates the generated contract after changing schemas. See [DATABASE.md](DATABASE.md) for database design and [the deployment plan](../AWS_DEPLOYMENT_PLAN.md) for AWS setup.
