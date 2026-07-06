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
