# TestSprite Prompt: Exhaustive Interaction Coverage

Use this prompt in TestSprite after the local demo app is running at `http://127.0.0.1:5174`. Use only synthetic/local demo data. Do not execute provider sends, real email/WhatsApp delivery, payment flows, or cloud mutations.

## Prompt

You are testing the Skyline Student Association web application. Do not stop after checking that pages load. Build a control-by-control interaction inventory and test plan from the actual rendered application.

**Goal: every discovered interactive control must have an explicit test case or a documented reason it cannot be safely executed.**

### Inventory scope

Inspect every public route and every applicable workspace route for each demo role: member, organizer, treasurer, admin, and college. Use the repository's route map and `docs/INTERACTION_COVERAGE.md` as hints, but verify the routes and controls in the running app.

For each route and role, inventory:
- Every visible button and control, including icon-only buttons, buttons inside tables, buttons that open dialogs/menus, tabs, menu items, custom comboboxes, sliders, toggles and other clickable surfaces.
- Every same-origin link and its destination.
- Every table/grid, header, row, clickable cell and row-level action.
- Every form, input, select, checkbox, radio, date/number/file control, validation message, submit action and cancel/close action.
- Every dialog, popover, drawer, search panel, dropdown and dynamically revealed control.
- Empty states, loading states, disabled controls, toast/error states and responsive navigation.

### Create one test case per behavior

Give every control a stable ID based on route, role, component/section, accessible name and occurrence index. Do not merge controls just because they share the same label: repeated row actions need separate cases.

For each control test, document:
1. Preconditions and persona.
2. Route and component/section.
3. Control ID and accessible name.
4. Initial enabled/disabled and selected state.
5. Action (click, keyboard activation, selection, typing, check/uncheck, drag/slider if appropriate).
6. Expected observable result, such as route change, selected state, sort order, filtered rows, opened/closed dialog, field value, toast, download, created/updated row, or validation error.
7. Any API request and response when relevant.
8. Cleanup and whether the scenario mutates local demo data.

For tables, verify sorting/filtering/search using expected row identities, not just the presence of changed text. Exercise each per-row action on its own target row. Check that no row is accidentally edited or removed by exercising another row's button.

For forms, cover empty submit, malformed values, valid values, boundary values, reset/cancel and server error behavior. Do not actually submit external integrations.

For modals/drawers, test open, close button, Escape where supported, backdrop behavior if supported, keyboard focus entry/restoration, and interaction with each control inside.

For routes controlled by permissions, test both authorized and unauthorized personas. Verify authorization at the API boundary when the action mutates data; hiding a button is not sufficient.

### Safety constraints

- Use the demo mode and isolated synthetic records.
- Never send actual WhatsApp, email or external notifications.
- Do not use live payment details or perform real payments.
- Skip calls that could mutate a shared production/staging database.
- When behavior cannot safely be executed, record the control as blocked with a precise reason instead of calling it passed.
- Never make up an expected result. If requirements are unclear, report the ambiguity and propose the expected behavior for human review.

### Output

Produce:
- A route-by-route, role-by-role component/control coverage matrix.
- One granular test case per distinct control behavior.
- An explicit list of every discovered button/control and status: passed, failed, blocked, skipped, or not yet executed.
- Table-by-table coverage, including each row-action button.
- A list of unnamed/ambiguous controls and inaccessible controls.
- A gap list where expected behavior needs a product decision or a focused Playwright assertion.
- Reproduction steps, screenshots and network evidence for failures.

Do not report complete coverage unless the inventory has been reconciled against all discovered controls, including controls revealed after clicks.
