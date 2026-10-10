# design.md — Design System & Page Specifications

> Reference: "NapMaster Tests" dashboard (teal, card-based, rounded, calm and academic).
> Goal: every page in the product (public, auth, app, admin) must feel like it belongs to the same family as that dashboard.
> Colour values are close approximations read from the reference image. Treat them as tokens and tune once in code, never hard-code hex in components.

---

## 1. Design Principles

1. **Calm, focused, academic.** Deep teal on soft off-white. No loud gradients, no neon.
2. **Cards are the unit of UI.** Every piece of information lives in a rounded card. Pages are grids of cards.
3. **One hero, many tiles.** Each page opens with one dark-teal "hero" card (greeting, headline, key numbers), followed by lighter tiles.
4. **Dark teal = emphasis, light tint = content.** Use dark teal cards for the most important or "summary" blocks (welcome, performance, upcoming). Use pale cards for browsable content.
5. **Colour codes meaning.** Each category/module gets one accent colour (teal, gold, green, purple) reused for its tag, progress bar, outline button and icon tint. Red is reserved for absent/weak/negative/destructive.
6. **Numbers are big, labels are small.** Key metrics are large and bold; labels are small and muted.
7. **Mobile-first behaviour, desktop-first composition.** Layouts are designed on a 12-column desktop grid and collapse cleanly to one column.
8. **Accessible by default.** Minimum 4.5:1 text contrast, visible focus rings, never colour alone to convey state.

---

## 2. Design Tokens

### 2.1 Colour

| Token                     | Value (approx.)         | Usage                                      |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `--bg-app-frame`          | `#0B6B68`               | Outer backdrop / marketing hero background |
| `--bg-page`               | `#F3F8F8`               | Main app canvas behind cards               |
| `--bg-sidebar`            | `#EAF3F3`               | Sidebar background                         |
| `--surface`               | `#FFFFFF`               | Top bar, inputs, modals                    |
| `--surface-card`          | `#F4F7F7`               | Light content cards                        |
| `--surface-card-hover`    | `#EAF1F1`               | Card hover                                 |
| `--primary`               | `#0F6B66`               | Hero cards, primary buttons, active states |
| `--primary-700`           | `#0B5753`               | Hover/pressed on primary                   |
| `--primary-300`           | `#7FB5B2`               | Illustration fills, chart gradient top     |
| `--primary-100`           | `#BFDCDD`               | Active nav item fill                       |
| `--primary-50`            | `#E3F0F0`               | Tag backgrounds, subtle fills              |
| `--text-on-primary`       | `#FFFFFF`               | Text on dark teal                          |
| `--text-on-primary-muted` | `rgba(255,255,255,.75)` | Secondary text on dark teal                |
| `--text-strong`           | `#0D1F1E`               | Headings on light                          |
| `--text-default`          | `#1F3F3D`               | Body on light                              |
| `--text-muted`            | `#6B8280`               | Labels, captions, placeholders             |
| `--border`                | `#D5E3E2`               | Card/input borders                         |
| `--accent-gold`           | `#8A6D1A`               | "Core" category                            |
| `--accent-green`          | `#1F8F5F`               | "Literature" category, success             |
| `--accent-purple`         | `#7A2EC0`               | "Creative" category                        |
| `--danger`                | `#D64545`               | Absent, weakness, errors, destructive      |
| `--warning`               | `#E0A526`               | Pending / expiring                         |
| `--success`               | `#1F8F5F`               | Paid, checked-in, confirmed                |
| `--info`                  | `#2B8AA0`               | Notices                                    |

Rules

- Each accent has a 3-step family: `solid` (bars, text), `tint` (tag bg, ~12% opacity), `outline` (button border).
- Progress bars: solid accent on a neutral track (`#D5E3E2`).
- Dark mode (optional, phase 2): swap `--bg-page` to `#0A2F2E`, keep cards one step lighter, keep teal hero cards as-is.

### 2.2 Typography

- **Family:** a clean geometric/humanist sans (Inter or Plus Jakarta Sans). Fallback: system-ui.
- Numeric figures: tabular numbers (`font-variant-numeric: tabular-nums`) in tables and stat tiles.

| Role                                                       | Size / Line | Weight  |
| ---------------------------------------------------------- | ----------- | ------- |
| Display (landing hero)                                     | 56 / 64     | 700     |
| H1 (page title, hero greeting)                             | 32 / 40     | 700     |
| H2 (card title, e.g. "Attendance", "Performance overview") | 24 / 32     | 600     |
| H3 (tile title, e.g. "Mathematics")                        | 20 / 28     | 600     |
| Stat value (e.g. "75%", "Top 4%")                          | 32–40 / 40  | 700     |
| Body                                                       | 14–16 / 24  | 400     |
| Label / caption                                            | 12–13 / 18  | 400–500 |
| Micro (chart legend, row meta)                             | 11 / 14     | 400     |

### 2.3 Spacing

4px base: `4, 8, 12, 16, 20, 24, 32, 40, 56, 80`.

- Card inner padding: **24px** (20px on mobile).
- Gap between cards: **24px** (16px on mobile).
- Page padding: 24px desktop, 16px mobile.

### 2.4 Radius

| Element                  | Radius  |
| ------------------------ | ------- |
| Outer app frame / modals | 28–32px |
| Cards                    | 24px    |
| Nested panels, list rows | 14–16px |
| Buttons, inputs          | 12px    |
| Tags / pills / badges    | 999px   |
| Icon tiles               | 12px    |

### 2.5 Elevation

- Cards: no hard shadow, rely on tint difference. Optional `0 1px 2px rgba(11,87,83,.06)`.
- Floating (modals, dropdowns, toasts): `0 12px 32px rgba(11,87,83,.18)`.
- App frame (marketing mock): `0 24px 64px rgba(0,0,0,.25)`.

### 2.6 Iconography

- Outline icons, 1.75px stroke, rounded caps (Lucide / Phosphor Regular).
- Sizes: 16 (inline), 20 (nav), 24 (tile), 32 (hero stat).
- Hero stat icons sit in a **white rounded square (48px, radius 12)** with a teal icon.
- Category tiles use a white rounded square icon container (44px) tinted with the category accent.

### 2.7 Motion

- Duration 150–200ms, ease-out. Hover: background shift + 2px lift on cards that are clickable.
- Charts animate on first render (600ms). Progress bars animate from 0.
- Respect `prefers-reduced-motion`.

---

## 3. Core Components

### 3.1 App Shell

- **Sidebar (left, 240px):** logo + product name top, vertical nav, motivational/promo card pinned lower, Logout pinned bottom.
- **Top bar (height 72px):** global search (left, wide, pill-ish 12px radius), notification bell button (tinted square), user chip (avatar + name + email) on the right.
- **Content area:** scrollable, page padding 24px, card grid.
- Sidebar collapses to icon rail at ≤1100px and to a bottom tab bar / drawer at ≤768px.

### 3.2 Navigation Item

- Default: pale fill, 1px `--border`, 12px radius, icon + label, 48px tall.
- Hover: `--primary-50`.
- **Active:** `--primary-100` fill, 1px `--primary` border, label in `--primary` bold.
- Badges (counts) appear as small teal pill on the right.

### 3.3 Hero Card (dark teal)

- Background `--primary`, radius 24, padding 24–32.
- Contents: small date/eyebrow text (muted white) → H1 greeting → one-line supporting sentence → row of 2–3 **stat blocks** (icon tile + label + big value).
- Right side holds a soft, translucent line-art illustration (e.g. open book) at ~30% opacity. No photos.

### 3.4 Stat Block

- White rounded icon tile (48px) + stacked: small muted label, large bold value.

### 3.5 Category / Module Tile (light card)

- Top row: icon tile (left) + small tag pill (right, accent tint, accent text).
- Title (H3).
- Row: "Course Progress" label ↔ percentage; progress bar (8px, fully rounded).
- Row: "Latest Score" label ↔ value.
- Full-width **outline button** in the accent colour: "Resume Learning".

### 3.6 Donut / Ring Card

- Title + legend (dots: Present = teal, Absent = red).
- Ring with centre percentage; segment colours teal / red.
- Footer: date selector with chevron (dropdown).

### 3.7 Chart Card (dark teal)

- Title left, **select dropdown** (outlined white, 12px radius) right.
- Area/smooth-line chart with gradient fill from `rgba(255,255,255,.55)` to transparent; faint horizontal grid with 0/25/50/75/100% labels; x-axis labels in muted white.
- Hover/active point: vertical highlight bar + white tooltip bubble (radius 10) with value.

### 3.8 Skills / Gaps List Card (light)

- Two sections: **Strengths** (teal heading) and **Weaknesses** (red heading).
- Each row: name • small coloured sub-label (category) • thin 6px bar • percent.
- Bar colours: teal for strengths, red for weaknesses.

### 3.9 Upcoming List Card (dark teal)

- Title, then stacked **row cards**: white background, radius 14, icon tile left, title + meta (date • duration, small), arrow-up-right icon on right.
- Whole row is a link.

### 3.10 Buttons

| Variant             | Style                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Primary             | `--primary` fill, white text, 12px radius, 48px tall (40 compact), hover `--primary-700` |
| Secondary / Outline | transparent, 1px accent border, accent text, hover accent tint                           |
| Ghost               | no border, text only, hover `--primary-50`                                               |
| Danger              | `--danger` text + tint bg for Logout-style actions; solid red only for confirm-delete    |
| Icon button         | 40px square, tinted bg (like the bell)                                                   |

States: hover, focus (2px `--primary` ring + 2px offset), disabled (50% opacity), loading (inline spinner, label retained).

### 3.11 Form Controls

- Inputs: white bg, 1px `--border`, 12px radius, 48px height, left icon optional (search, mail, lock).
- Focus: border `--primary` + soft ring. Error: border `--danger` + helper text in red with icon.
- Select, checkbox, radio, switch, date-picker, file-upload (drag zone with dashed border) all use `--primary` as the checked colour.
- Labels above fields, 13px, medium weight. Helper text 12px muted.

### 3.12 Tags / Badges

- Pill, 12px text, accent-tint bg, accent text. Status variants: Paid / Active (green), Pending / Expiring (amber), Overdue / Absent / Cancelled (red), Draft (neutral).

### 3.13 Tables

- Inside a light card. Header row: muted small caps text, no heavy fills. Rows: 56px, 1px bottom border, hover tint.
- Sticky header, sortable columns (chevron), row actions in a kebab menu, bulk-select checkbox column, pagination footer.
- Mobile: rows become stacked cards.

### 3.14 Modals, Drawers, Toasts

- Modal: white, radius 28, 24px padding, scrim `rgba(7,40,39,.45)`.
- Side drawer (right, 420px) for create/edit forms.
- Toast: dark teal, white text, bottom-right, auto-dismiss 4s; success/error icon at left.

### 3.15 Empty, Loading, Error States

- Empty: centred line-art illustration in teal tints, H3, one sentence, primary button.
- Loading: skeleton cards with shimmer matching the final layout (never a bare spinner on a page).
- Error: red-tint card with message, retry button.

### 3.16 Avatars

- 40px circle, photo or initials on `--primary-100`. Used in top bar, member lists, task assignees (stack with -8px overlap, max 4 then "+n").

---

## 4. Layout & Responsiveness

- Max content width 1440px; app grid is 12 columns, 24px gutter.
- Breakpoints: `sm 640`, `md 768`, `lg 1100`, `xl 1440`.
- Typical dashboard grid (desktop):
  - Row 1: Hero (8 cols) + Ring/summary card (4 cols)
  - Row 2: four equal tiles (3 cols each)
  - Row 3: Chart (6 cols) + List card (3 cols) + List card (3 cols)
- Tablet: 2 columns. Mobile: 1 column, hero stats wrap to stacked rows.
- Touch targets ≥ 44px.

---

## 5. Page Specifications

Every authenticated page uses the **App Shell** (3.1). Page header pattern: H1 title + one-line description on the left, primary action button on the right, optional filter bar below.

### 5.1 Landing Page (public)

Sections, in order:

1. **Top nav** (white, sticky): logo, links (Features, Events, Shop, Pricing/Membership, About), `Log in` ghost button, `Join now` primary button.
2. **Hero:** teal background (`--bg-app-frame`) with a large rounded white "browser/app frame" containing a real dashboard screenshot (as in the reference). Left/above: Display headline, one-line subhead, two CTAs (primary + outline-white), small social-proof line.
3. **Feature grid:** 3–6 light cards, icon tile + title + 2-line description.
4. **How it works:** 3 numbered steps on a dark-teal band with white text.
5. **Highlights / live preview:** upcoming events or featured shop items as tiles (reuse tile component 3.5).
6. **Testimonials / stats strip:** 3 big numbers (stat blocks).
7. **FAQ:** accordion in light cards.
8. **Final CTA band:** dark teal card, headline + primary button (white).
9. **Footer:** light tint, link columns, social icons, copyright.

### 5.2 Authentication Pages

Pages: **Login, Sign up, Forgot password, Reset password, Verify email / OTP.**

- Layout: split screen. **Left (50%)** dark-teal panel with logo, translucent line-art illustration and a short motivational line (like "Keep Practicing, Keep Improving!"). **Right (50%)** white panel with a centred 400px form card.
- Form: H1, subtext, fields, primary full-width button, divider "or", social login buttons (outline), footer link switching between login/sign-up.
- Sign up adds: name, email, password with strength meter, terms checkbox.
- OTP: 6 separate input boxes, resend timer.
- Mobile: illustration panel hidden; logo on top, form full width.
- Errors inline under fields; global error as red-tint banner above the form.

### 5.3 Onboarding (first login)

- Centred card on `--bg-page` with progress dots (3–4 steps): profile → preferences → role/group → done.
- Final step shows a dark-teal hero card "You're all set" with a CTA to the dashboard.

### 5.4 Dashboard (home)

Replicates the reference:

- Hero: date, "Welcome back, {name}", motivational sentence, 2 stat blocks.
- Side card: ring chart summary (attendance / completion).
- Row of 4 module tiles with accent-coloured progress and outline buttons.
- Row: performance chart (dark), skills/gaps or "needs attention" list (light), upcoming list (dark).
- Sidebar promo card with a motivational line and a faint line-art icon; Logout at the bottom.

### 5.5 List / Index Pages (e.g. Courses, Members, Events, Orders, Tasks)

- Page header with title, count, primary "Add / Create" button.
- Toolbar: search, filter chips or dropdowns, sort, view toggle (cards ↔ table).
- Card view: grid of module tiles (3.5). Table view: table (3.13).
- Bulk actions bar appears on selection (dark teal strip).
- Pagination or infinite scroll with skeletons.

### 5.6 Detail Pages (e.g. a course, an event, a member, an order)

- Breadcrumb + title + status tag + action buttons.
- Top: dark-teal hero card with key facts (stat blocks).
- Below: tabs (Overview, Activity, Attendees/Members, Payments, Settings) in pill style, active tab = `--primary-100`.
- Right rail (3–4 cols) with summary card and quick actions.

### 5.7 Create / Edit Forms

- Opens as a full page for large entities or a right drawer for small ones.
- Sections as stacked cards with H3 titles; sticky footer bar with `Cancel` (ghost) and `Save` (primary).
- Inline validation, unsaved-changes warning, autosave indicator for long forms.

### 5.8 Analytics / Reports

- Filter bar (date range, category).
- KPI row: 4 stat tiles (light) with delta indicator (green up / red down).
- Charts: dark-teal area chart card, light bar/line cards, donut cards; consistent gradient style, rounded corners on bars.
- Export buttons (CSV / PDF) as outline buttons top-right.
- Tables below for drill-down.

### 5.9 Calendar / Schedule

- Month/week toggle; events as rounded chips coloured by category accent.
- Side panel "Upcoming" using list card 3.9.
- Click on event opens detail drawer.

### 5.10 Notifications

- Bell opens a popover (360px) with grouped list (Today, Earlier); unread dot in teal.
- Full page version: list rows with icon tile, text, timestamp, mark-as-read action.

### 5.11 Profile & Settings

- Left sub-nav (Profile, Account, Notifications, Billing, Security, Appearance) as vertical pills.
- Content cards per section; avatar uploader; switch rows for preferences; danger zone card with red outline at the bottom.

### 5.12 Checkout / Payments (shop, tickets, dues)

- Two-column: order summary card (dark teal, line items, totals, member discount line) + payment form card (light).
- Steps indicator at top. Success page: large green check in a white tile, order details card, "Download receipt" and "Back to dashboard" buttons.

### 5.13 Scanner / Check-in (mobile-first)

- Full-screen camera view with teal rounded viewfinder corners; result sheet slides up.
- Result states: **Valid** (green card, name, ticket type, member badge), **Already used** (amber), **Invalid** (red). Large type, haptic/sound feedback, one-tap "Next scan".
- Manual search fallback field at top.

### 5.14 Public Event / Shop Pages (no login)

- Event page: banner hero (teal overlay), date/location stat blocks, ticket-type cards (member vs non-member price, seats left progress bar), sticky "Get tickets" CTA.
- Shop page: product grid (tile style), size selector chips, stock indicator ("5 left" amber tag), cart drawer.

### 5.15 Finance / Ledger

- Hero: Balance (big), Money in, Money out as three stat blocks.
- Charts: income vs expense area chart, breakdown donut by source (dues, tickets, merchandise, fundraisers).
- Transaction table with category tags, receipt attachment icon, status (Approved / Pending / Reimbursed).
- Expense request form in a drawer with receipt upload.

### 5.16 Task / Project Board

- Header with progress ring + "on track / at risk" tag.
- Columns (To do, Doing, Done) as light cards with draggable task rows; assignee avatars, due date chip, priority dot.
- Alternate list view with progress bar per fundraiser/project.

### 5.17 Announcements / Communications

- Composer card: title, rich text, audience selector (all / group), channel toggles (email, web, push), schedule picker.
- Feed: chronological cards with date, author avatar, read count tag; archive is searchable.

### 5.18 Admin / Settings Area

- Same shell with an extra "Admin" nav group; role & permission matrix as table with switches; audit log table; integrations as tiles with connect buttons.

### 5.19 Utility Pages

- **404 / 500 / Maintenance / Offline:** centred line-art illustration, H1, sentence, primary "Back to dashboard" button.
- **Terms / Privacy:** narrow readable column (720px) on `--bg-page`, light card, table of contents on the side.

---

## 6. Content & Tone

- Friendly, encouraging, concise. Greeting on dashboard uses first name. Short motivational lines in promo spots.
- Buttons are verbs: "Resume Learning", "Get tickets", "Save changes". Avoid "Submit".
- Dates: `Monday, October 25` in hero; `25 May 2026` in lists. Durations: `45 Minutes`.
- Percentages without decimals unless needed. Scores as `94/100`. Currency uses locale format (₹ for India) with thousands separators.

---

## 7. Accessibility Checklist

- Text on `--primary` is white (contrast ≥ 7:1). Muted white text must stay ≥ 4.5:1 — raise opacity if not.
- Small accent labels (e.g. 11px sub-labels) must not be accent colour alone: pair with text or icon.
- Charts: provide data table alternative; don't rely on red/green alone (add icons/labels).
- All interactive elements keyboard reachable, visible focus ring, logical order; modals trap focus.
- Landmarks: `header`, `nav`, `main`, `aside`. Skip-to-content link.
- Form errors announced via `aria-live`.

---

## 8. Implementation Notes

- Build tokens as CSS variables (or Tailwind theme extension) from section 2; components consume tokens only.
- Suggested stack-agnostic component library: AppShell, Sidebar, TopBar, HeroCard, StatBlock, ModuleTile, RingCard, ChartCard, ListCard, DataTable, FormField, Tag, Button, Modal, Drawer, Toast, EmptyState, Skeleton, Avatar.
- Keep one chart library (e.g. Recharts / Chart.js) themed once with the token palette.
- Illustrations: single-colour line-art using `--primary-300` at reduced opacity; store as SVG.
- Every new page must be composable from the components above; if a new pattern is needed, add it to section 3 before using it.

---

## 9. Addendum — Shop Grid, Mobile, Landing, Dense Tables, Image Hover

> Added from four new references: **LeadU** (mobile app), **Learnly LMS** (landing page), **ASOS fit-chip concept** (product grid and image hover), **Owari** (data tables).
> Where this section conflicts with sections 3 or 5, **this section wins** for the page types it names.

### 9.1 Merchandise Shop — Separate Tab with Horizontal Product Grid

**Placement**

- "Shop" is its own item in the sidebar (desktop) and bottom tab bar (mobile). Route: `/shop`. It is not embedded in the dashboard; the dashboard may show a small "Featured merch" strip that links here.
- Page header: H1 "Shop", cart icon button with count badge, optional "My orders" ghost button.

**Category tabs (above the scroller)**

- Pill tabs: `All · Hoodies · T-shirts · Accessories · On sale`. Active = `--primary-100` fill + `--primary` text. "On sale" shows a small red dot when any discount is live.
- Optional sort select (Newest, Price low→high, Price high→low, Biggest discount).

**Horizontal scroller**

- One row per category section ("Hoodies", "T-shirts"…) with H2 title, "View all" link, and left/right arrow buttons (40px round, tinted, disabled at the ends).
- Container: `overflow-x: auto; scroll-snap-type: x mandatory; gap: 24px; padding-bottom: 8px`. Cards use `scroll-snap-align: start`.
- Card width: 260px desktop, 220px tablet, **~72vw on mobile** so the next card peeks in (signals scrollability).
- Mouse drag, trackpad, touch swipe, and keyboard (←/→ when a card is focused) all work. Hide the native scrollbar on desktop, show a thin progress bar under the row.
- Edge fade (24px gradient to `--bg-page`) on the side that has more content.
- "View all" switches the section to a wrapped grid (4 columns desktop, 2 mobile).

**Product card (light card, radius 24)**

1. Image area, 4:5 ratio, radius 16, `object-fit: cover`, neutral background while loading (skeleton).
2. Top-left: **discount badge** (red pill, e.g. `-20%`) or tag (`New`, `Members only`, `Low stock`).
3. Top-right: wishlist heart icon button (white circle, 36px).
4. Below image: product name (14–16px, medium, 1 line, ellipsis), then **price row**.
5. Price row: current price bold (`₹799`). If discounted: original price struck-through, muted (`₹999`). If the user is a member and a member price exists: second line `Member price ₹699` with a small teal "Member" pill.
6. Size chips row (XS S M L XL, 28px square, 1px border, radius 8). Out-of-stock sizes are dimmed with a diagonal strike. Chips behave per 9.5.
7. Stock hint: `Only 5 left` (amber text) when stock ≤ 10; `Sold out` (red) disables the card's add action.

**Discount presentation**

- Live discounts: red `-N%` badge on image + struck-through old price + optional countdown line (`Ends in 2d 04h`) in small red text.
- Discount section at the top of the Shop tab (only when active): a dark-teal hero strip with the offer title (e.g. "Hoodie Week — 20% off"), end date, and a "Shop the sale" primary-white button that filters to On sale.
- Discount types supported in the UI: percentage off, fixed amount off, member-only price, bundle (e.g. "Buy hoodie + tee, save ₹150"), promo code (entered at cart).
- Several discounts never stack silently: the cart shows each applied line with its label, and the best valid one is applied automatically with a note.

**Product detail (on click)**

- Desktop: opens a **right drawer (560px)** over the grid, URL updates to `/shop/{slug}` so it is shareable and the back button closes it. Mobile: full-screen page with back arrow.
- Contents: image gallery (large image + thumbnails, swipe on mobile, zoom on click), name, price block (same rules as the card, larger), description, material/fit notes, **size selector with live stock per size** (`M — 3 left`), size guide link opening a table modal, quantity stepper, discount options block, delivery/pickup note, reviews summary if available.
- **Discount options block:** lists every offer that applies to this product as selectable rows (radio): label, saving amount, conditions ("Members only", "Ends 31 Oct"). Includes a promo-code field with an Apply button. Selected offer updates the price instantly.
- Sticky bottom bar inside the drawer: total price and `Add to cart` (primary). Secondary: `Buy now`.
- Related products: another horizontal scroller at the bottom.

**States:** loading skeleton cards in the row; empty category ("Nothing here yet") with illustration; error with retry; sold-out card with grayscale image and `Notify me` ghost button.

### 9.2 Image Hover & Quick Fit Chip (from the ASOS concept)

Applies to product cards on desktop. On touch devices the same info is always visible (no hover state).

- **Resting state:** image, name, price, size chips, as in 9.1.
- **Hover (150–200ms ease-out):**
  - Card lifts 2px; image scales to `1.04` inside its rounded mask (no layout shift).
  - Wishlist heart goes from 70% to 100% opacity.
  - A **quick-add bar** slides up from the bottom of the image: `Quick add` button (white, radius 12). Clicking opens a size chooser popover, not the full drawer.
  - If a second image exists, crossfade to it (300ms) instead of scaling.
- **Fit guidance chip (optional feature):** below the size chips, a lavender/teal-tint pill with a shirt icon and text `Likely fit: M`, shown when the user has a saved size or past purchase. Pill style: radius 999, 12px text, `--primary-50` background, `--primary` text. It must not change card height between cards: reserve its space even when empty.
- Focus-visible on keyboard shows the same hover treatment.
- Respect `prefers-reduced-motion`: no scale/slide, only a border colour change.
- Assumption to confirm: the reference image shows the chip but not the hover animation itself. The motion above is my proposal. If you have a link to the exact hover behaviour, send it and this section will be tightened.

### 9.3 Mobile App UI (from LeadU)

- **Frame:** 390 × 844 base; safe-area padding top/bottom. Background white, content on pale tinted cards.
- **Splash:** white screen, centred wordmark only. Wordmark style: serif with the **last letter in the accent colour** (the LeadU treatment). Use our own name set the same way; ~600ms then fade.
- **Top bar:** left logo wordmark (small), right bell icon and 36px circular avatar. No title text.
- **Bottom tab bar (5 items max):** Home, Calendar, Routine, Shop/Resource, Profile. Icon 24px + 10px label. **Active tab: icon and label in `--primary`**, inactive in muted grey. Height 64px + safe area, 1px top border, white background.
- **Section headers:** 16px bold serif or sans heading (match system font; reserve serif for the wordmark and splash) with a small right-aligned meta (e.g. `Today: 3 July, 2024`).
- **Reminder / list card pattern:** pale-teal card, radius 12. Left date block (big day number, month, time under a thin divider, with a small coloured dot for priority). Middle title + 1-line meta (course / owner). Right: full-height solid `--primary` check button (tap to mark done), radius 12 on the right edge.
- **Countdown card:** large centred `480 : 49 : 32` (tabular figures, 28–32px bold) on pale card; label above.
- **News / content card:** thumbnail left (80px), title, time, 3-line excerpt, `more` link.
- **Forms (Sign up, Profile):** each field is a pale-tint input row with a **leading icon** (user, mail, phone, institute, ID, lock), placeholder in muted text, 44px height, radius 8. Two fields can share a row (Batch + Section). Password has eye toggle. Primary full-width button (gradient teal → deep blue allowed here), "Already a user? Log in" link under it.
- **Profile:** centred avatar (80px), read-only field rows with icons, outlined `Edit` button full width (becomes `Save` primary in edit mode).
- **Calendar:** month header with chevrons, 7-column grid, today highlighted with a tinted circle, event days show a small dot (colour = category), tapping a day opens a bottom sheet with that day's items.
- **Select list (e.g. Select Course):** stacked pale cards with title, code line, instructor line; tap selects and highlights border in `--primary`.
- Gestures: pull-to-refresh on lists, swipe on horizontal scrollers, bottom-sheet drag to dismiss. Tap targets ≥ 44px.

### 9.4 Landing Page Theme (from Learnly LMS) — overrides 5.1 visuals

Structure stays as 5.1. Visual treatment changes to this **dark hero** look:

- **Page frame:** page background a muted olive/taupe, with the site inside one large rounded frame (radius 48px) filled with near-black (`#0E1210` → `#17140C` subtle warm gradient). Inside the frame, content max-width 1200px.
- **Nav:** logo (gold, bold) left; centre links (Home, Subject/Shop, Pricing, About Us, FAQs) in white 15px; right `Log In` (outline gold pill) and `Sign Up` (gold gradient pill, dark text). Pills are fully rounded, 44px tall.
- **Landing tokens (scoped to the landing page only):**

| Token               | Value                                     |
| ------------------- | ----------------------------------------- |
| `--land-bg`         | `#0E1210`                                 |
| `--land-surface`    | `#171C19`                                 |
| `--land-text`       | `#F4F1E8`                                 |
| `--land-text-muted` | `#B7B2A3`                                 |
| `--land-gold`       | `#C9A227`                                 |
| `--land-gold-grad`  | `linear-gradient(180deg,#D8B544,#8F6F14)` |
| `--land-outline`    | `#C9A227` at 1px                          |

- **Hero:** left column H1 (display, 56–64px, medium weight, white) with a short two-line subhead in muted text; two CTAs (gold gradient `Start Free Trial` with play icon + outline `Subscribe Now`/`Join now`). Right column: a **3D-style illustrated character or product render** that bleeds off the right/bottom edge, lit with a warm orange rim light.
- **Social proof:** overlapping avatar trio, `132K Student`-style count, `Reviews` underlined with `4.9 out of 5`. A small hand-drawn gold arrow pointing to it.
- **Brand decision to confirm:** the app uses teal (sections 2–8) and the landing reference uses gold on black. The simplest consistent choice is to use the **gold-on-dark landing** for public pages only and switch to the teal system after login. If you want one palette everywhere, replace `--land-gold` with `--primary-300` and keep the dark background. Pick one before building.
- Remaining sections (features, how it works, shop highlights, FAQ, footer) reuse the dark surface with `--land-surface` cards, radius 24, gold icon tiles and gold headings.

### 9.5 Size Chips and Variant Selectors

- Chip: 28px (card) / 44px (drawer) square, 1px `--border`, radius 8, 12–14px text, centred.
- States: default, hover (`--primary-50`), selected (`--primary` border + `--primary-50` fill), disabled/out of stock (40% opacity + diagonal line).
- On a card, clicking a chip selects the size without opening the drawer; it enables `Quick add`.
- Colour variants (if any) are 20px round swatches before the size row.

### 9.6 Dense Data Tables (from Owari) — overrides 3.13 for data-heavy pages

Use for the finance ledger, members, orders, ticket check-in lists, and any report table. Density is a user toggle: **Comfortable (default, 48px rows) / Compact (32px rows)**.

**Typography**

- Header: 11px, uppercase, 600, letter-spacing `0.04em`, colour `--text-muted`, small sort caret after sortable labels.
- Body: 12–13px (13px comfortable, 12px compact), 400, `--text-default`.
- Numeric columns: right-aligned, `tabular-nums`, optionally slightly heavier (500).
- Section/group label rows (e.g. `TODAY`): 11px uppercase on `--primary-50`, full-width.

**Structure**

- White card, radius 16, 1px `--border`. No vertical gridlines; 1px horizontal separators only. Header row 1px stronger bottom border.
- Sticky header and, where useful, sticky first column. Horizontal scroll inside the card on small screens.
- Row hover: `--primary-50` background; selected row: `--primary-100` with left 3px `--primary` bar. Row actions (edit icon, swap icon) appear on hover at the far right.
- Footer: row count, pagination or "Load more".

**Value styling**

- Positive change: green text with `▲`; negative: red text with `▼`. Always pair colour with the arrow.
- Type/status pills inside cells: 10–11px bold uppercase, radius 4, solid fill (e.g. `BID` green, `OFR` red, `MKT` blue, `NEW` bright green). Use the same pill for `PAID / PENDING / REFUNDED` etc.
- Empty cell: `—` in muted, never blank.

**Controls around the table**

- **Segmented tabs** for datasets (e.g. `AGO | ATK | PMS` pattern → `All | Paid | Pending`): boxed buttons, active has 1px dark border and white fill, inactive muted.
- **Filter chips** with `×` to remove (pale grey fill, radius 6), a `+` chip to add a filter, and a preset dropdown at the left of the filter bar.
- Unit/format toggles (e.g. `USD/MT`) as small muted text buttons aligned right.
- Primary table action (`Upload`, `Add expense`) as an outlined dark button top-right of the card.
- **Tooltips:** near-black (`#0D1F1E`) rounded 6px label, white 12px text, appears next to cursor/focus; used for truncated values and chart points. A chart's hover tooltip shows value + date on two lines.
- Mini-charts inside the same card (line/area, green palette, last value tags at the right edge as small filled labels).

**Tickers / alerts:** optional bottom strip (black, white text, bold label `Breaking news:` + scrolling items separated by `•`) for announcements. Use sparingly; pausable on hover; must have a close button.

### 9.7 Additional Tokens Introduced

| Token             | Value                 | Use                                               |
| ----------------- | --------------------- | ------------------------------------------------- |
| `--discount`      | `#D64545`             | Discount badge, struck-through context, countdown |
| `--discount-tint` | `rgba(214,69,69,.12)` | Discount offer rows                               |
| `--member`        | `#0F6B66`             | Member price pill                                 |
| `--stock-low`     | `#E0A526`             | "Only N left"                                     |
| `--tooltip-bg`    | `#0D1F1E`             | Table/chart tooltips                              |
| `--row-hover`     | `#E3F0F0`             | Table row hover                                   |

---

## 10. Extension Slot — Product Requirements

> Add the product document here (or link to it). For each feature in it, map it to:
>
> 1. a page type from section 5,
> 2. the components from section 3,
> 3. the accent colour used for its module.

Example mapping for a student-organization product (from the supplied brief):

| Feature                  | Page type                                     | Accent                         |
| ------------------------ | --------------------------------------------- | ------------------------------ |
| Members & dues, renewals | 5.5 List + 5.6 Detail                         | teal                           |
| Events & ticketing       | 5.14 Public event + 5.13 Scanner + 5.8 Report | purple                         |
| Announcements            | 5.17                                          | green                          |
| Merchandise shop & stock | 5.14 Shop + 5.12 Checkout + 5.5 List (orders) | gold                           |
| Fundraiser tasks         | 5.16 Board                                    | green                          |
| Treasurer ledger         | 5.15 Finance                                  | teal (danger red for expenses) |
