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

### Shared UI components (added 2026-07-06)
- `src/components/edit-dialog.tsx` — `<EditDialog title="…">` client modal used for ALL row-edit
  buttons (production, sales, purchases, expenses, electricity, customers, vendors). Do NOT go back
  to `<details>` popovers: they get clipped by the tables' `overflow-x-auto` containers.
- `src/components/searchable-select.tsx` — `<SearchableSelect name options value|defaultValue …>`
  combobox that submits via a hidden input. Used for every dropdown (customer, vendor, material,
  shift, expense category). `allowCustom` makes typed text the value and shows a "+ Add" row
  (expense categories). Semi-controlled: pass `value`+`onChange` to auto-select after quick-add.
- Quick-add customer/vendor panels must NOT render a nested `<form>` (invalid HTML, browser strips
  it — button silently submits the outer form). They use controlled inputs without `name` attrs and
  call the server action directly in `startTransition`; `createCustomer`/`createVendor` return the
  new `id` in `ActionState` for auto-select.

### MonthPicker component (`src/components/month-picker.tsx`)
- Client component: `<MonthPicker value="YYYY-MM" />` (optional `paramName` prop, default `"month"`).
- Wrap in `<Suspense>` when used in a server component (reads `useSearchParams`).
- Page reads `searchParams.month` and falls back to `currentMonthParam()`.

### Invoice page
- `/sales/[id]/invoice` lives under `src/app/(invoice)/` route group (NOT under `(app)/`) so it renders without the app shell nav.
- Has its own minimal layout at `src/app/(invoice)/sales/[id]/invoice/layout.tsx`.
- Uses `print:hidden` on the controls bar; `window.print()` via `<PrintButton>` client component.

### Module locations
- `/production` → `src/app/(app)/production/` (upsert by date — unique constraint; form enters ONE
  shift at a time via Day/Night dropdown, action only touches that shift's column)
- `/sales` → `src/app/(app)/sales/` (delete = ADMIN only via `requireAdmin()`)
- `/purchases` → `src/app/(app)/purchases/` (material filter via `?material=` query param;
  `ratePerKg` = (materialCost + handlingCost) / weightKg is computed in the actions and STORED on
  the row — migration `20260706102643` backfilled old rows)
- `/expenses` → `src/app/(app)/expenses/` (category = SearchableSelect with `allowCustom` over
  distinct existing DB values)
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

---

## Ledgers, Supplier rename & WhatsApp invoices (added 2026-07-06)

### Vendor → Supplier rename
- Model `Vendor`→`Supplier`, `VendorPayment`→`SupplierPayment`, field `vendorId`→`supplierId`,
  tables `suppliers`/`supplier_payments`, routes `/vendors`→`/suppliers`,
  `/reports/vendors`→`/reports/suppliers`. Done via a data-preserving `ALTER TABLE … RENAME`
  migration (`20260706110000_supplier_rename_and_ledgers`) — no data loss. `prisma.supplier` /
  `prisma.supplierPayment` are the client accessors. There is NO "vendor" left anywhere in `src/`.

### Running-balance ledgers (the money model)
- **`CustomerPayment`** (receipts) + **`SupplierPayment`** now both have a `method` field
  (Cash/Bank/Cheque/Online, default Cash). `Customer` & `Supplier` have an `openingBalance`
  Decimal (positive = they owe us / we owe them; carried from old sheets).
- **`v_customer_ledger`** / **`v_supplier_ledger`** — true running-balance transaction views
  (like `v_contractor_ledger`): OPENING row + each SALE/PURCHASE (debit) + each PAYMENT (credit),
  with `SUM(amount) OVER (PARTITION BY <party> ORDER BY date NULLS FIRST, sort_order, entry_id)`.
  Columns: `<party>_id`, `entry_id`, `date`, `entry_type`, `description`, `debit`, `credit`,
  `amount` (signed), `balance`. **`entry_id` of a SALE row = the sale's `id`; of a PAYMENT row =
  the payment's `id`** (used directly for invoice links and delete — no fragile date+amount match).
- **`v_customer_summary`** / **`v_supplier_summary`** — one row per party for the list pages
  (`outstanding` / `balance_owed` = opening + debits − credits, plus last_*_date columns).
  The OLD `v_customer_ledger`/`v_vendor_ledger` summary shapes are GONE — `reports/customers` &
  `reports/suppliers` now read the `_summary` views.
- Detail pages: `/customers/[id]`, `/suppliers/[id]` (ledger + Record Payment). Statement:
  `/customers/[id]/statement` (date-range, printable; carries a brought-forward opening balance).
- Aging: `src/lib/aging.ts` (`agingBucket`) + `src/components/aging-badge.tsx` (`<AgingBadge date|daysOverdue>`),
  wired into the customer list Outstanding column. Receivables-oriented (Current / 31–60 / 60+),
  so it's on customers only, not suppliers.

### WhatsApp invoice sharing (shares the invoice IMAGE, zero backend cost)
- **Decision:** share the invoice as a PNG file, NOT a link. `wa.me` links can't attach files, so
  the button renders the on-page invoice to a PNG **client-side** and hands the file to WhatsApp via
  the native share sheet (`navigator.share({ files })`). Zero backend (no server render / no API).
  Tradeoff: a file attachment can't pre-select the customer's number — the sender picks the WhatsApp
  contact in the share sheet.
- `src/components/share-whatsapp-button.tsx` ("use client"): `domToPng(document.getElementById("invoice-capture"), { scale: 2, backgroundColor: "#fff" })`
  → `File` → `navigator.share({ files:[file], text: caption })`. Desktop / no file-share → downloads
  the PNG with a "open WhatsApp and attach it" notice. Caption (no link) = `invoiceCaption()` in
  `src/lib/invoice-share.ts`.
- **Use `modern-screenshot` (`domToPng`), NOT `html-to-image`.** html-to-image's `toPng` HANGS
  silently on this app (foreignObject/font embedding never resolves, even with `skipFonts:true`).
  modern-screenshot renders the same node in ~600ms. This is the only new runtime dependency here.
- The invoice page passes `id="invoice-capture"` to `<InvoiceDocument>` (it has an optional `id` prop)
  so the button captures the tight max-w-2xl invoice box, not the full-width wrapper.
- `src/components/invoice-document.tsx` — shared presentational invoice (emerald branding, leaf
  monogram, Total Due bar, print-safe `[print-color-adjust:exact]`). Keep `InvoiceDocumentProps`
  required-field shape stable — used by the authed invoice page AND the public `/i/[token]` page.
- **Still present but NO LONGER used by the share button:** `PelletSale.shareToken`,
  `getOrCreateShareToken()` (invoice actions.ts), the public no-auth route `/i/[token]`
  (`src/app/(public)/i/[token]/page.tsx`, allowed via `startsWith("/i/")` in the `authorized`
  callback), `toWhatsappNumber()` (phone.ts), `buildWhatsappUrl()`/`invoiceShareMessage()`. Retained
  as the **future upgrade path**: automated WhatsApp Business API (Twilio/Meta) sends need a hosted
  invoice URL + a real phone number, which these already provide.

### Operator role lockdown + expense category dropdown fix (2026-07-08)
- **Operator capabilities are now exactly:** add/edit production (`upsertProductionDay`), view
  production history, add a sale (`createSale`), quick-add a customer from the sale form
  (`createCustomer` stays `requireUser` for this). Everything else is ADMIN-only.
- Enforced in three layers (all must stay in sync when adding a module):
  1. Nav: `adminOnly` flags in `src/components/nav-items.ts` (operator sees Production + Sales only).
  2. Edge: `ADMIN_PREFIXES` in `src/auth.config.ts` now covers reports/settings/users/customers/
     suppliers/contractor/electricity/purchases/expenses, plus an EXACT match on `/` (dashboard).
     Non-admins bounce to `/production`. `/i/` public invoice links unaffected.
  3. Server: `requireAdmin()` on all admin-only pages + server actions. `requireAdmin()` now
     redirects to `/production` (not `/`) since the dashboard itself is admin-only — avoids a loop.
- Sales page for operators renders ONLY the Record Sale form; the sales history query is skipped
  entirely (`isAdmin ? findMany : []`) so past sales never enter the RSC payload. `updateSale`,
  `deleteSale`, and the invoice route/actions are admin-only. `deleteProductionDay` is admin-only
  and its button is hidden for operators on the production page.
- The old `OperatorHome` dashboard component was removed; operators land on `/production`.
- **`SearchableSelect` fix:** clicking/focusing now always shows the FULL options list; filtering
  only kicks in after the user types (a `typedSinceOpen` STATE flag — it must be state, not a ref,
  because `filtered` is a `useMemo` and a ref reset on reopen wouldn't invalidate it). This fixed
  the expense category combobox hiding previously saved categories behind the pre-filled
  "Maintenance" text. Categories themselves were already persisted via `distinct: ["category"]`.

### Autofill styling + production audit fields (2026-07-08)
- **Autofill white-background fix:** browsers force a pale background on autofilled inputs
  (`:-webkit-autofill`), turning fields white in dark mode when the user picks a browser
  suggestion (e.g. the Expense "Item" field). Global override in `globals.css`: 1000px inset
  box-shadow matching the field bg (#fff light / #0a0a0a dark = the inputs' `dark:bg-neutral-950`)
  + `-webkit-text-fill-color` + a huge `background-color` transition delay. Covers input/
  textarea/select everywhere; Firefox via `input:autofill`. Don't style autofill per-component.
- **ProductionDay audit fields:** `createdById`/`createdBy` + `updatedById`/`updatedBy` (both
  optional User relations, named `ProductionDayCreatedBy`/`ProductionDayUpdatedBy`) + `updatedAt`.
  Migration `20260708083303_production_created_updated_by`. `upsertProductionDay` stamps
  `createdById` on create and `updatedById` on update (upsert = one row per date, so saving the
  second shift of a day counts as an update). `updatedBy` stays NULL until someone edits after
  creation; rows from before the migration show "—" in the new "Entered By" column on
  /production. Operators can still edit any entry (owner's decision) — this is audit, not ACL.

### Opening balance Dr/Cr + ledger row editing (2026-07-08)
- **Opening balance sign convention (root cause of the "-50,000 became 50,000" report):**
  `Customer.openingBalance` is stored SIGNED — positive = customer owes us (Dr), negative =
  advance/credit we owe them (Cr). Typing -50,000 was stored correctly but posted to the CREDIT
  column ("Rs 50,000.00 Cr"), the opposite of the outstanding the user meant. The customer form
  now submits an unsigned amount + an explicit `openingBalanceType` select (DR "Customer owes us —
  outstanding" / CR "Customer paid in advance — credit"); `parseOpeningBalance()` in
  customers/actions.ts applies the sign (`Math.abs` + direction), so a typed minus sign can never
  flip the meaning. An outstanding balance is entered as a POSITIVE amount with type DR.
- **Ledger row editing (admin):** every row on /customers/[id] now has Edit — OPENING opens the
  customer form, SALE opens EditSaleForm (prefilled with GROSS rate = ratePerBag +
  loadingChargePerBag; server re-splits), PAYMENT opens the new EditCustomerPaymentForm backed by
  `updateCustomerPayment` (payments were previously delete-only). `updateSale` now revalidates
  /customers and both old+new customer detail pages since sales can be edited from the ledger.
- Credit balances render as "Rs X Cr" (green) on the customers list Outstanding column and the
  detail-page Outstanding card ("Customer advance (we owe)") instead of a raw negative number.

### Rs 10/bag loading charge split (2026-07-08)
- **Every sale carries a fixed Rs 10/bag loading charge inside the price the user types.** The
  form still asks for ONE customer-facing rate (e.g. 2,500); `splitRate()` in sales/actions.ts
  stores `ratePerBag` = entered − 10 (net pellet price, 2,490) + new `loadingChargePerBag` = 10
  (constant `LOADING_CHARGE_PER_BAG` in constants.ts). Validation rejects rates ≤ 10.
- **Gross vs net rule:** anything the customer sees or owes uses GROSS (net + loading) — invoice
  pages, v_customer_ledger debits, v_customer_summary.total_sales/outstanding. Reports split it:
  sales table + /reports/customers show a Loading column; v_monthly_summary.sales_revenue is now
  NET with a separate `loading_charges` column shown on P&L as "pass-through, not in profit"
  (the Rs 10 is collected for the loaders, it is not pellet revenue).
- **Edit forms round-trip on gross:** EditSaleForm is prefilled with net + loading and the server
  re-splits on save, so editing without touching the rate is a no-op.
- Migration `20260708091300_loading_charge_split` adds the column, backfills existing sales
  (rate − 10 / charge 10 where rate > 10 — gross totals & balances unchanged), and rebuilds
  v_customer_ledger / v_customer_summary (+ total_loading) / v_monthly_summary (+ loading_charges).
  Gotcha: an already-running `next dev` keeps the OLD generated Prisma client in memory after
  `prisma generate` — pages 500 with "Cannot read properties of undefined (reading 'toNumber')"
  until the dev server is restarted.

### Sales form Enter-key flow + post-save reset (2026-07-08)
- **Enter now walks the Record Sale form instead of submitting:** date → customer → quantity →
  rate → notes; Enter on notes submits. Implemented as `handleEnterNav` (form-level onKeyDown) in
  sales/sale-forms.tsx — it skips events already handled (`e.defaultPrevented`), so Enter with the
  customer dropdown open picks the highlighted option (SearchableSelect's own handler) and the NEXT
  Enter advances. Quick-add customer inputs are excluded via `data-enter-nav-skip` on their wrapper.
  Applied to both CreateSaleForm and EditSaleForm.
- **After a successful save the create form resets** (form.reset() + customerId state cleared) but
  the date is re-set to today and refocused for rapid entry. Triggered by a useEffect on
  `state.ok` from useActionState.
- **Two dev servers in one folder:** Next 16's dev lock lives in distDir, so next.config.ts now
  honors `NEXT_DIST_DIR`; launch.json's `erp-dev` runs with `NEXT_DIST_DIR=.next-preview` on port
  3011 so a preview server can run alongside the main dev server (.next-preview is gitignored).
