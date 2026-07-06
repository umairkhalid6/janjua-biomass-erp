# ERRORS.md — Error Log

This file is a chronological log of errors encountered during development,
along with their root causes and resolutions. Agents and developers should
append new entries here when they hit a non-trivial problem so future
contributors can find solutions quickly.

**Format:**
```
## YYYY-MM-DD — Short title
**Error:** <exact error message or description>
**Cause:** <what caused it>
**Fix:** <how it was resolved>
```

---

<!-- Append new entries below this line -->

## 2026-07-06 — Prisma P1010 "User was denied access" on localhost:5432
**Error:** `P1010: User was denied access on the database` from every Prisma CLI command, while `psql` inside the container worked fine.
**Cause:** A native (non-Docker) Postgres already listens on 127.0.0.1:5432 on this machine. Prisma was connecting to it instead of the compose container, and user `erp` doesn't exist there.
**Fix:** Host port mapping moved to 5433 (`POSTGRES_PORT=5433` in `.env`, `DATABASE_URL` → `localhost:5433`). Compose-internal URL unchanged (`postgres:5432`).

## 2026-07-06 — Prisma 7 client: "requires either adapter or accelerateUrl"
**Error:** `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"`.
**Cause:** Prisma 7 removed the bundled connection handling; a driver adapter is mandatory.
**Fix:** Installed `@prisma/adapter-pg`; `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` in `src/lib/prisma.ts` and `prisma/seed.ts`.

## 2026-07-06 — `prisma db seed` says "No seed command configured"
**Error:** Seed entry in `package.json` (`"prisma": { "seed": ... }`) was ignored.
**Cause:** Prisma 7 moved seed configuration to `prisma.config.ts` under `migrations.seed`.
**Fix:** Added `seed: "npx tsx prisma/seed.ts"` there. Also added `import "dotenv/config"` to `seed.ts` — tsx does not auto-load `.env`, so `pg` fell back to the OS username as database name (`Database "umairkhalid" does not exist`).

## 2026-07-06 — Auth.js v5 middleware "must export a function"
**Error:** `The file "./src/middleware.ts" must export a function, either as a default export or as a named "middleware" export.` (Next 16 build), plus a deprecation warning steering to a `proxy` file.
**Cause:** Next 16 renamed the middleware convention to `proxy` and no longer recognizes the `export const { auth } = NextAuth(...)` destructuring as a function export.
**Fix:** Kept `src/middleware.ts` but assigned `const { auth } = NextAuth(authConfig)` then `export default auth;` (a real default function export). Build passes; the deprecation warning is cosmetic. If Next drops the `middleware` name later, rename the file to `src/proxy.ts` and switch to `export function proxy`.

## 2026-07-06 — Session callback: "Type 'unknown' is not assignable to type 'string'"
**Error:** Type error on `session.user.id = token.id` in `src/auth.config.ts`.
**Cause:** The `next-auth/jwt` module augmentation for `JWT.id`/`JWT.role` wasn't reliably applied inside the edge config, so `token.id` stayed `unknown`.
**Fix:** Cast at the assignment (`token.id as string`, `token.role as Role`). Augmentation still lives in `src/types/next-auth.d.ts` for session typing everywhere else.

## 2026-07-06 — recharts 3 Tooltip `formatter`: implicit-any / incompatible-signature type errors
**Error:** Building the report charts failed to type-check on every `<Tooltip formatter={...}>`.
First `Parameter 'v' implicitly has an 'any' type`, then (after adding explicit param types)
`Type '(v: number, ...) => ...' is not assignable to type 'Formatter<ValueType, NameType>'` —
`ValueType | undefined` (which includes `ReadonlyArray<number|string>`) is not assignable to a
narrowed `number`.
**Cause:** recharts 3's `Formatter` value param is `ValueType | undefined` where
`ValueType = number | string | ReadonlyArray<number|string>`. A hand-written or narrowed signature
is contravariantly incompatible with what `<Tooltip>` expects.
**Fix:** Export `type TooltipFormatter = Formatter` (imported from
`recharts/types/component/DefaultTooltipContent`, default generics) in
`src/components/charts/palette.ts`, define each formatter as a module-level
`const fmt: TooltipFormatter = (v, name) => [formatPKR(Number(v)), String(name)]`, and pass
`formatter={fmt}`. Coerce value/name with `Number()`/`String()` inside — do NOT narrow the params.

## Sheet bugs fixed structurally in the new schema (documented for the record)
The old Google Sheets workbook had these calculation errors, which the SQL views fix by construction:
1. `Main!N16` (Total Monthly Cost) added chip **weight (KG)** instead of chip **cost (PKR)** and omitted the actual chip cost.
2. Haideri Plywood sawdust purchases were never linked into monthly cost.
3. Multiple SUM ranges excluded trailing data rows (e.g. production on the 31st of the month was not counted in monthly totals).
4. "Average Rate/KG" label on the Main sheet actually showed rate per 40-kg bag.
Numbers from the new system will intentionally differ from the old sheet wherever these bugs applied.
