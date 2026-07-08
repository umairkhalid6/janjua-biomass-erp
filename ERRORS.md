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

## 2026-07-06 — Railway prod: `TypeError: Invalid URL` (input `'https://'`) on every request
**Error:** Container starts fine ("Ready in 0ms") but every request 500s with `TypeError: Invalid URL … code: 'ERR_INVALID_URL', input: 'https://'` in the edge middleware chunk.
**Cause:** Auth.js (NextAuth v5) builds internal URLs from `AUTH_URL`/`NEXTAUTH_URL`. The Railway var was set to a bare `https://` with no host (typically `https://${{RAILWAY_PUBLIC_DOMAIN}}` where the domain reference resolves empty). `new URL("https://")` throws — the crash is inside Auth.js, before our `authorized` callback runs.
**Fix:** Two layers, in `src/auth.config.ts`: (1) an IIFE at module load validates `AUTH_URL`/`NEXTAUTH_URL` and `delete`s them if they aren't a valid absolute URL with a host; (2) `trustHost: true` hardcoded in the config so the host is taken from Railway's `x-forwarded-host` proxy header regardless of env. On Railway, set `AUTH_URL` to the real domain (e.g. `https://your-app.up.railway.app`) or remove it entirely — auth now works either way. `AUTH_SECRET` is still required.

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

## 2026-07-06 — PWA setup and documentation (not an error — recorded for reference)
**Setup completed:**
- Installed `@ducanh2912/next-pwa@10.2.9` with Workbox; compatible with Next 16
- Configured caching to exclude financial data (HTML, /api/*, server actions) — all use NetworkFirst with no fallback
- Generated app shell caching for `_next/static` and `/public` (24-hour max age)
- Created `public/manifest.json` with dark green theme and icon references
- Generated PWA icons programmatically (192x192, 512x512, maskable variants, 180x180 apple-touch-icon) via node script using PNG binary headers
- Updated `src/app/layout.tsx` with `manifest`, `appleWebApp`, and `viewport` metadata exports
- Updated `next.config.ts` to wrap with withPWA, disabling in development
- Completed comprehensive README.md with all sections (overview, quick start, dev guide, phone access, deployment, PWA installation, troubleshooting)
- Verified `npm run build` completes successfully; manifest and icon assets present in `.next/standalone/public/`

**Key decisions:**
- Chose `@ducanh2912/next-pwa` over `@serwist/next` because it's simpler, battle-tested, and uses Workbox (industry standard)
- Icons are "any + maskable" — ensures compatibility across platforms and future app store requirements
- Service worker auto-generated at build time; no manual registration needed
- 5433 port note documented in `.env.example` for future developers working on this machine

## 2026-07-06 — Hand-rolled PNG icons were corrupt / marginal
**Error:** `public/icons/icon-512*.png` were 0×0 (unreadable); the 192px ones opened in `sips` but failed stricter decoders.
**Cause:** `scripts/generate-icons.js` writes PNG chunks by hand and produced invalid files at 512px.
**Fix:** Rendered the SVG templates to PNG with macOS `qlmanage -t -s <size>` and replaced all PNGs. If icons ever need regenerating, prefer `qlmanage`/a real image library over the hand-rolled writer.

## 2026-07-06 — PWA front-end-nav caching would serve stale financials
**Error:** (design bug, caught in review) `cacheOnFrontEndNav` + `aggressiveFrontEndNavCaching` were enabled in next.config.ts, which caches page documents on client-side navigation.
**Cause:** Plugin conveniences conflict with the requirement that financial data is never shown stale.
**Fix:** Removed both flags; runtimeCaching covers `_next/static` assets only, so documents and API calls always hit the network.

## 2026-07-06 — /production (and 4 other CRUD pages) crashed on load
**Error:** Clicking Production (also Sales, Purchases, Expenses, Electricity) crashed the page with Next.js "Event handlers cannot be passed to Client Component props" (digest error in production build).
**Cause:** The Delete buttons in these server-component pages had an inline `onClick={(e) => { if (!confirm(...)) e.preventDefault(); }}` — event handlers can't be serialized from a Server Component. The pages are dynamic (auth + searchParams), so `next build` passed and the crash only surfaced at request time.
**Fix:** New client component `src/components/delete-button.tsx` (`"use client"`, submit button with the confirm() guard) used inside each delete `<form action={...}>` on all five pages.

## 2026-07-06 — "Quick add customer/vendor" buttons did nothing
**Error:** On /sales and /purchases, filling the quick-add panel and clicking Add produced no request and no feedback.
**Cause:** The quick-add `<form action={...}>` was rendered *inside* the main create form. Nested forms are invalid HTML — the browser drops the inner `<form>` tag, so the Add button became a submit button for the outer form, whose empty required fields blocked submission silently.
**Fix:** Rewrote `QuickAddCustomer`/`QuickAddVendor` without a form: controlled inputs (no `name`, so they don't leak into the outer form's submission) and a `type="button"` Add that calls the server action directly via `startTransition`. `createCustomer`/`createVendor` now return the new `id` so the parent can auto-select it.

## 2026-07-06 — Edit popovers overlapped/clipped on all table screens
**Error:** The `<details>`-based Edit popover rendered on top of the row's Edit/Delete buttons and was clipped by the table's `overflow-x-auto` container (screenshot from user on /production; same pattern on /sales, /purchases, /expenses, /electricity, /customers, /vendors).
**Cause:** The popover was absolutely positioned inside the scroll container, so it inherited its clipping and stacking context.
**Fix:** New `src/components/edit-dialog.tsx` — a fixed-position centered modal with overlay (Escape/backdrop close, body scroll lock) — replaces the `<details>` pattern on all seven screens.

## 2026-07-08 — Railway prod: P2022 ColumnNotFound (`pellet_sales.loadingChargePerBag`, `production_days.createdById`) — migrations silently never applied
**Error:** After deploying, /sales and /production crashed with Prisma P2022: columns from the two newest migrations didn't exist in the Railway database, even though the build succeeded and `preDeployCommand` included `npx prisma migrate deploy`.
**Cause:** The runner image had neither the `prisma` CLI (`node_modules/prisma` was never copied — only `@prisma/*` and `.prisma`) nor `prisma.config.ts`. Under Prisma 7 the datasource URL lives in `prisma.config.ts` (schema.prisma has no `url`), so even a CLI downloaded ad hoc by `npx` at pre-deploy time couldn't resolve the datasource, and no migration was ever applied. Hand-copying the CLI package alone is not enough: `@prisma/config` has non-`@prisma` runtime deps (`effect`, `c12`, `deepmerge-ts`, `empathic`, plus transitive), so a partial copy dies with MODULE_NOT_FOUND.
**Fix:** Dockerfile gained a dedicated `migrate` stage (`npm install prisma@<version from package.json>`) whose complete `node_modules` is copied to `/migrate` in the runner, together with `prisma.config.ts` and `prisma/` (schema + migrations) — fully isolated from the app's standalone `node_modules` so no version clobbering. `preDeployCommand` is now `cd /migrate && node node_modules/prisma/build/index.js migrate deploy` (pinned local CLI, no npx download). Verified locally by replicating the exact `/migrate` layout and running the exact command against the dev DB. Caveat: if prod's `_prisma_migrations` table is missing (DB originally created via `db push`), `migrate deploy` fails with P3005 and needs a one-time baseline via `prisma migrate resolve --applied <migration>`.

---

## Sheet bugs fixed structurally in the new schema (documented for the record)
The old Google Sheets workbook had these calculation errors, which the SQL views fix by construction:
1. `Main!N16` (Total Monthly Cost) added chip **weight (KG)** instead of chip **cost (PKR)** and omitted the actual chip cost.
2. Haideri Plywood sawdust purchases were never linked into monthly cost.
3. Multiple SUM ranges excluded trailing data rows (e.g. production on the 31st of the month was not counted in monthly totals).
4. "Average Rate/KG" label on the Main sheet actually showed rate per 40-kg bag.
Numbers from the new system will intentionally differ from the old sheet wherever these bugs applied.
