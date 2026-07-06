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
- Auth: not yet configured — the auth agent installs Auth.js v5 (credentials + ADMIN/OPERATOR).
