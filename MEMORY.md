# MEMORY.md — Project Decisions & Context

This file serves as persistent context for AI agents working on this codebase.
Update it as significant decisions are made.

---

## Decisions

### Database
- **Postgres over MongoDB**: All core data is relational (sales, purchases, inventory, users). Financial records require referential integrity and transaction support — Postgres is the right fit.

### UI Approach
- **NocoDB dropped in favour of custom ERP UI**: NocoDB was evaluated but discarded; it doesn't offer enough control over business logic, workflows, or mobile-friendly layouts. We build a custom Next.js UI instead.

### Roles
- **ADMIN** — full access: settings, users, all reports, all CRUD operations.
- **OPERATOR** — day-to-day data entry: production logs, sales, purchases. No user management or financial summaries.

### Units & Currency
- **Amounts in PKR** (Pakistani Rupee). No multi-currency support planned.
- **Production and sales measured in 40-kg bags** (`BAG_KG = 40`, see `src/lib/constants.ts`). Bag counts are `Decimal(12,2)` (partial bags allowed); weight in KG is derived (`bags × 40`).
- **Raw material purchases measured in KG** (biomass feedstock bought by weight).

### Tech Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS v4, `src/` layout)
- Prisma 7 + PostgreSQL 16
- Auth.js v5 (AUTH_* env vars)
- Docker Compose for local dev; Railway/Render for production

### Deployment
- `next.config.ts` uses `output: 'standalone'` for Docker image compatibility.
- All config via env vars — no hardcoded hostnames or secrets.

---

## Domain Vocabulary

| Term | Meaning |
|------|---------|
| Bag | 40-kg pellet bag (unit of production/sale) |
| BAG_KG | 40 (constant — kg per bag) |
| Feedstock | Raw biomass material purchased in KG |
| Run | A production run (date, bags produced, feedstock consumed) |

---

## Future Agents — Read This

- Models: `prisma/schema.prisma` — DONE. Tables: users, customers, vendors, material_purchases
  (one table for all 4 material types via `MaterialType` enum), vendor_payments, pellet_sales
  (auto-increment `invoiceNo`), production_days, expenses (generic `category`, default
  'Maintenance'), electricity_bills, contractor_rates (effective-dated), contractor_payments,
  contractor_adjustments (opening balances).
- Reports are **SQL views** (not Prisma models — query via `prisma.$queryRaw`):
  `v_monthly_summary`, `v_material_totals`, `v_labor_daily`, `v_contractor_ledger`,
  `v_customer_ledger`, `v_vendor_ledger`, `v_production_summary`.
  Defined in `prisma/migrations/20260706070005_report_views/migration.sql`.
- PKR amounts are Prisma `Decimal(14,2)`. Serialize Decimals before passing to client components.
- **Prisma 7 gotchas** (all hit and fixed, see ERRORS.md): client requires a driver adapter
  (`@prisma/adapter-pg`, wired in `src/lib/prisma.ts`); seed command lives in
  `prisma.config.ts` `migrations.seed`, NOT package.json; scripts must import `dotenv/config`.
- Local dev DB: Docker Compose postgres on host port **5433** (5432 is taken by a native
  Postgres on this machine). Inside compose it's still `postgres:5432`.
- Seed: admin user from ADMIN_EMAIL/ADMIN_PASSWORD env, contractor rate 6 PKR/kg, opening
  balance adjustments totalling 504,730 PKR owed to the Thekadar (verified against the sheet).
- Auth: **DONE** — Auth.js v5 (`next-auth@5.0.0-beta.31`), Credentials provider, JWT sessions
  (no DB session table). Split-config pattern for edge middleware:
  - `src/auth.config.ts` — edge-safe (NO Prisma/bcrypt). Holds `pages`, `session.strategy`,
    the `jwt`/`session` callbacks (put id + role on token/session), and the `authorized`
    callback that middleware uses for gating. Cast `token.id as string`, `token.role as Role`.
  - `src/auth.ts` — full Node config: spreads `authConfig` and adds the Credentials provider
    whose `authorize()` does the Prisma lookup + bcrypt compare (rejects inactive users).
    Exports `handlers`, `auth`, `signIn`, `signOut`.
  - `src/middleware.ts` — `const { auth } = NextAuth(authConfig); export default auth;`
    (NOT destructured-const export — Next 16 rejects that; see ERRORS.md). Matcher excludes
    `/api/auth`, `_next`, static assets. `/login` is public (handled in `authorized`).
  - `src/app/api/auth/[...nextauth]/route.ts` — re-exports `handlers` GET/POST.
  - `src/types/next-auth.d.ts` — augments `session.user` with `id` + `role`.
- **RBAC helpers** in `src/lib/auth-helpers.ts`: `requireUser()` / `requireAdmin()`. Both are
  async, read the JWT session, and `redirect()` on failure (never return null). Call at the top
  of EVERY server action and protected RSC, e.g.
  `export async function createSale(...) { const user = await requireUser(); ... }`
  or `await requireAdmin()` for admin-only mutations. Middleware gates *routes*; these gate
  *server actions* (which middleware does not see).
- **Route gating:** ADMIN-only prefixes = `/reports`, `/settings`, `/users` (in
  `ADMIN_PREFIXES` in auth.config.ts). OPERATORs hitting those are redirected to `/production`.
  Unauthenticated → `/login?callbackUrl=...`. To add a new admin-only area, add its prefix there
  AND set `adminOnly: true` on its nav item.
- **App shell / nav:** authenticated pages live under the `(app)` route group
  (`src/app/(app)/`), wrapped by `src/app/(app)/layout.tsx` (renders `AppShell`). `/login` is
  OUTSIDE the group. Nav config = `src/components/nav-items.ts` (`NAV_ITEMS` + `visibleNavItems`);
  shell = `src/components/app-shell.tsx` (sidebar ≥768px, hamburger drawer on mobile). Add new
  pages as `src/app/(app)/<route>/page.tsx` and an entry in nav-items.ts.
- **User management:** `/users` (ADMIN only) — create/toggle-active/reset-password via plain
  server actions in `src/app/(app)/users/actions.ts`. Admins can't deactivate themselves.

---

## CRUD Conventions (added 2026-07-06)

### Form pattern
- Pages are server components; forms are `"use client"` in a co-located `*-forms.tsx` file.
- Actions are `"use server"` in `actions.ts` with `export type ActionState = { error?: string; ok?: string }`.
- Client forms use `useActionState<ActionState, FormData>(action, {})` + `useFormStatus` for the submit button spinner.
- Call `requireUser()` (or `requireAdmin()` for admin mutations) at the top of every server action.
- Call `revalidatePath("/route")` after every successful mutation.
- Use `parseDateInput(value: string): Date` from `src/lib/format.ts` to convert `<input type="date">` strings to UTC-midnight Date objects (avoids timezone shift).
- Serialize Prisma `Decimal` values via `.toNumber()` before passing to any client component or plain object.

### Format helpers (`src/lib/format.ts`)
- `formatPKR(n)` — PKR currency string via Intl.NumberFormat
- `formatDate(date)` — DD/MM/YYYY
- `formatMonth(month)` — "July 2026"
- `parseMonthParam(s)` — YYYY-MM → UTC midnight Date (1st of month)
- `parseDateInput(s)` — YYYY-MM-DD → UTC midnight Date
- `currentMonthParam()` — current month as "YYYY-MM"
- `toDateInputValue(date)` — Date → "YYYY-MM-DD" (reads UTC parts, no timezone shift)
- `monthRange(monthParam)` — `{ gte, lte }` for Prisma date range queries

### MonthPicker component (`src/components/month-picker.tsx`)
- Client component: `<MonthPicker value="YYYY-MM" />` (optional `paramName` prop, default `"month"`).
- Wrap in `<Suspense>` when used in a server component (reads `useSearchParams`).
- Page reads `searchParams.month` and falls back to `currentMonthParam()`.

### Invoice page
- `/sales/[id]/invoice` lives under `src/app/(invoice)/` route group (NOT under `(app)/`) so it renders without the app shell nav.
- Has its own minimal layout at `src/app/(invoice)/sales/[id]/invoice/layout.tsx`.
- Uses `print:hidden` on the controls bar; `window.print()` via `<PrintButton>` client component.

### Module locations
- `/production` → `src/app/(app)/production/` (upsert by date — unique constraint)
- `/sales` → `src/app/(app)/sales/` (delete = ADMIN only via `requireAdmin()`)
- `/purchases` → `src/app/(app)/purchases/` (material filter via `?material=` query param)
- `/expenses` → `src/app/(app)/expenses/` (category datalist from existing DB values)
- `/electricity` → `src/app/(app)/electricity/` (upsert by month)
- `/customers` → `src/app/(app)/customers/`
- `/vendors` → `src/app/(app)/vendors/`
- `/contractor` → `src/app/(app)/contractor/` (balance from `v_contractor_ledger` via `$queryRaw`)
- `/settings` → `src/app/(app)/settings/` (ADMIN — contractor rate history)

---

## PWA (Progressive Web App) — Added 2026-07-06 (reworked same day)

**No PWA plugin.** `@ducanh2912/next-pwa` was tried and REMOVED: it hooks into webpack,
and Next 16 builds with Turbopack, so it silently generated nothing (see ERRORS.md).

**Current setup (hand-rolled, zero deps):**
- **Service worker:** plain static file `public/sw.js` — cache-first for `/_next/static/`,
  `/icons/`, and font/image files ONLY. All other requests (documents, `/api/*`, server
  actions) are not intercepted → financial data is never cached/stale. Bump the
  `STATIC_CACHE` version string in sw.js when changing caching behavior.
- **Registration:** `src/components/sw-register.tsx` ("use client", production only),
  rendered from the root layout.
- **Icons:** SVG templates in `public/icons/*.svg` + `public/apple-touch-icon.svg`,
  rendered to PNG with macOS `qlmanage -t -s <size>` (the hand-rolled PNG writer in
  `scripts/generate-icons.js` produced corrupt files — do not reuse it for PNGs).
- **Manifest:** `public/manifest.json`, dark green theme (#065f46), standalone display;
  wired via `metadata`/`viewport` exports in `src/app/layout.tsx`.

**Why this design:** The 5433 port mapping is specific to this developer's machine (native Postgres on 5432); future agents may work on different machines. The PWA supports offline fallback for the UI shell only — critical business rule is that financial data never stays cached/stale.

---

## Reporting / Dashboard Layer (added 2026-07-06)

### Home dashboard (`src/app/(app)/page.tsx`)
- Role-aware server component. ADMIN sees current-month headline cards (Sales / Total Cost /
  Profit / Production from `v_monthly_summary`), contractor balance (last row of
  `v_contractor_ledger`), quick links, and a 6-month profit trend area chart. OPERATOR sees only
  today's production (queried from `production_days`) + Log Production / Record Sale shortcuts.
- Today's production keys on `toDateInputValue(new Date())` cast to `::date`.

### Report pages (`src/app/(app)/reports/*`, all ADMIN)
- `/reports` — landing cards. `/reports/pnl` — P&L table + 12-month history + profit bar chart.
  `/reports/production` — daily day/night table + stacked daily chart + 12-month trend line.
  `/reports/materials` — per-material cards/table + 6-month stacked cost chart.
  `/reports/contractor` — running-balance ledger filtered by month with an opening-balance line +
  earned-vs-paid chart. `/reports/customers` & `/reports/vendors` — simple sorted ledger tables.
- Every page calls `await requireAdmin()` first (belt-and-braces beyond middleware).

### Raw-query conventions (views are the data API)
- Query views with `prisma.$queryRaw<RowType[]>\`...\``. **pg returns numerics as strings** —
  coerce EVERY numeric column with `Number()` before use/serialization. Row types declare numeric
  columns as `string | number`.
- View column names differ from the older `/contractor` CRUD page: the real columns are `date`,
  `entry_type`, `description`, `amount`, `balance` (NOT `entry_date`/`running_balance`). Check
  `information_schema.columns` when unsure.
- **Contractor "current balance"** = the row that is LAST in the window's order
  (`ORDER BY date, entry_type, description`). Query it with
  `ORDER BY date DESC, entry_type DESC, description DESC LIMIT 1` — sorting by date alone can pick
  the wrong row (seed final balance = 504,730).

### Charts (`src/components/charts/*`, recharts 3.9)
- `recharts` is the only new dependency. Each chart is a small `"use client"` component taking
  plain serializable number props (no Decimals/Dates). Server pages pre-map view rows into
  `{ label, ... }` arrays.
- Shared palette + tooltip-formatter type in `src/components/charts/palette.ts`. Tooltip
  `formatter` MUST be typed `TooltipFormatter` (= recharts' `Formatter` from
  `recharts/types/component/DefaultTooltipContent`) and coerce value/name with `Number`/`String`
  inside — see ERRORS.md for why a narrowed signature fails to type-check.
- Components: `profit-bar-chart`, `profit-trend-chart` (area), `production-daily-chart` (stacked),
  `production-trend-chart` (line), `material-stacked-chart` (dynamic series), `contractor-monthly-chart`.
  `compact()` + `tooltipStyle` are shared out of `profit-bar-chart.tsx`.
- All charts use `ResponsiveContainer` (heights 200-260px), PKR-formatted tooltips via `formatPKR`.
