# Interaction and Component Coverage

This branch adds a Playwright-based interaction audit for Skyline Student Association. It is intended to find untested or broken controls, not to silently certify behavior just because a click completes.

## Local setup

Use a disposable local demo environment only. This audit resets browser local storage and clicks application controls. **Do not point it at production or a shared staging environment.**

```powershell
npm ci
npm install -D playwright
npx playwright install chromium
npm run dev:demo
```

Open another terminal from the repository root:

```powershell
$env:PLAYWRIGHT_MODULE = "playwright"
node scripts/interaction-coverage.cjs
# Optional deeper pass: exercise every enabled select option individually
npm run test:forms
```

Optional overrides:

- `TEST_URL`: local base URL; defaults to `http://127.0.0.1:5174`.
- `INTERACTION_REPORT_DIR`: report directory; defaults to `.artifacts`.
- `HEADED=1`: run headed Chromium for debugging.
- `INTERACTION_SCREENSHOTS=0`: disable screenshots on failed button interactions.
- `CHECK_LINK_CLICKS=0`: inventory/validate links without clicking them.
- `INTERACTION_TIMEOUT_MS`: per-action timeout in milliseconds; defaults to 2500.

The report is written to `.artifacts/interaction-coverage.json`. The optional `npm run test:forms` pass writes `.artifacts/form-control-coverage.json` and tries enabled select options separately. Treat reported failures as needing triage, not automatically as product defects; exploratory audits can expose timing issues or controls requiring specific fixtures.

## What the audit covers

- Every discovered visible button, button-role element, tab, menu item, summary control, and standard action control on the route/role matrix. It clicks enabled controls in isolated browser contexts, records disabled controls separately, and recursively follows newly revealed buttons in menus and dialogs.
- Additional non-semantic React elements with a React `onClick` handler, where they are not already represented by a standard button/link. These are inventoried and exercised separately.
- Visible same-origin links, including navigation destinations and links inside tables. External, email, telephone, download, and new-tab links are inventoried but skipped for safety.
- Inputs, select fields, textareas, checkboxes, radio buttons, sliders and comboboxes. Inputs receive harmless test data; forms are not submitted by the field audit.
- Tables and grids: table/row inventory, discoverable headers, row cell-count warnings, all row action names, and button/link click tests for rendered row actions.
- Accessibility smoke checks for button/link names, visible field labels and image alt attributes.
- Browser page errors, empty pages after interaction, action outcomes (route change, dialog, visible text change, or no detectable effect) and screenshots for failed button clicks.
- Authorization-route probes for representative role combinations.

## Component-by-component inventory

| Component/feature | Routes or area | Interactive coverage to expect |
|---|---|---|
| Application routing and public shell | `/`, `/events`, `/clubs`, `/shop`, unknown URL | Navigation, route fallback, links, buttons, forms, responsive layout |
| Public club pages | `/clubs/:id` | Club links and calls to action |
| Event discovery | `/events` | Filters, search, archive, event cards and pagination/tabs if rendered |
| Event experience/details | `/e/:clubId/:id`, `/app/events/:id` | Gallery, share, review tabs, event actions, ticket CTA |
| Authentication | `/login`, `/signup`, `/verify-email` | Fields, visibility toggles, submit buttons, validation controls |
| Workspace shell | `/app/*` | Sidebar, mobile drawer, top bar, account/club/notification menus, global search, quick actions |
| Role dashboards | `/app`, `/app/college` | Dashboard actions, role-appropriate links, dashboard controls |
| Membership and people | `/app/members`, `/app/users` | Directory/table actions, search, role and status controls, dialogs |
| Calendar and events | `/app/calendar`, `/app/events`, `/app/events/manage` | View controls, filters, event rows/cards, creation/edit actions |
| Ticketing and check-in | `/app/my-tickets`, `/app/check-in`, `/app/checkout` | Ticket buttons, check-in controls, form fields, table actions |
| Merchandise and orders | `/app/merchandise`, `/app/my-orders`, `/shop` | Product selectors, variant/quantity controls, checkout, order actions |
| Points and promos | `/app/contributions` | Tabs/filters, promo actions and form controls |
| Tasks | `/app/tasks`, `/app/my-tasks` | Task lists, state filters, dialogs, task action buttons |
| Finance and expenses | `/app/finance`, `/app/expenses` | Ledger table, filters, sort buttons, CSV control, receipt/view/approval actions and expense forms |
| Communications | `/app/announcements` | Announcement forms, editor, tabs, publish controls (provider sends are skipped) |
| Audit trail | `/app/audit` | Table filters, sort, search and row controls |
| Personal account | `/app/profile`, `/app/my-card` | Preferences, profile fields, membership card links and QR-related controls |
| College administration | `/app/college-clubs`, `/app/club-summary` | Registry tables, club selection and summary links |
| Shared UI | Buttons, fields, modal, search field, badges, cards, empty states, icons, QR code, charts | Runtime coverage through each route on which these shared components render |

The route matrix lives in `scripts/interaction-coverage.cjs`; add a route and its intended demo roles whenever a new workspace route or role is added.

## Important limits and required follow-up

A generalized click can prove that an element is visible and operable, but it cannot infer the complete business rule for every action. For each P0/P1 feature, keep a focused assertion test in addition to this audit:

- Save/create updates the expected record and shows success/error feedback.
- Delete/cancel/approve/reject changes only the correct record and handles confirmation.
- Search/filter/sort changes the correct result set, not merely any visible text.
- Booking and ordering maintain authoritative prices, capacity and stock.
- Finance actions enforce reviewer permissions and separation of duties.
- Modals trap/restore keyboard focus and close using supported controls.
- Failed requests preserve prior data and present a recoverable error.
- Duplicate requests are idempotent and concurrent updates cannot overbook or oversell.

The generic audit deliberately skips actions whose labels indicate external messaging or provider calls. Test WhatsApp/email/AI integrations with mocked providers or explicit test credentials in a separate, controlled suite. Real payment processing is out of scope because the project defines payments as simulated.

## Interpreting the report

- `clicked`: the control was clicked and did not cause a detected JavaScript error or blank page. Inspect the `effect` field and confirm the intended business result in a focused test.
- `disabled-state-covered` / `state-covered`: a disabled or read-only state was observed and left unchanged.
- `safety-skipped`: metadata was reviewed but a potentially external side effect was not executed.
- `failed`: the action could not be exercised, an accessible name was missing, the page errored, or the interaction produced a blank view.
- `warnings`: includes table layout mismatches and actions with no observable visible effect; validate whether the behavior should have been visible.

TestSprite prompt: [docs/TESTSPRITE_INTERACTION_PROMPT.md](TESTSPRITE_INTERACTION_PROMPT.md) tells TestSprite to create a distinct case per control/row action and to report every control as passed, failed, blocked, skipped, or not yet executed.
- Coverage denominators are the controls discovered in the specific route/role state. A control hidden behind a menu is only counted once the menu-opening action reveals it.
