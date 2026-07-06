# Deploying to Production (Railway)

This app is a Next.js (standalone output) + Prisma + PostgreSQL stack. Code and
migrations deploy automatically; **data does not**. A fresh production database
starts empty, so the only thing you seed is the first admin. Everything else
(customers, suppliers, contractor rates and opening balances, etc.) is entered
through the app UI.

---

## 1. Provision

1. Create a new Railway project.
2. Add a **PostgreSQL** plugin. Railway exposes its connection string as
   `DATABASE_URL` (reference it, don't hardcode).
3. Add your app service from this repo. The repo ships a multi-stage
   [`Dockerfile`](Dockerfile); Railway will build it automatically.

## 2. Environment variables

Set these on the **app service** in Railway → Variables:

| Variable          | Required | Notes |
|-------------------|----------|-------|
| `DATABASE_URL`    | ✅       | Reference the Postgres plugin, e.g. `${{Postgres.DATABASE_URL}}`. Append `?schema=public` if not already present. |
| `AUTH_SECRET`     | ✅       | NextAuth session signing key. Generate with `openssl rand -base64 32`. Sessions break without it. |
| `AUTH_TRUST_HOST` | ✅       | Set to `true` (required behind Railway's proxy). |
| `AUTH_URL`        | ✅       | Public HTTPS URL of the app, e.g. `https://your-app.up.railway.app`. |
| `ADMIN_EMAIL`     | bootstrap | Email for the first admin the seed creates. **Omit after first deploy** if you'd rather create admins in the UI. |
| `ADMIN_PASSWORD`  | bootstrap | Password for that admin (no default — seed skips admin creation if unset). |
| `ADMIN_NAME`      | optional | Display name for the bootstrap admin (defaults to `Admin`). |

> There is **no** hardcoded fallback account. If `ADMIN_EMAIL` / `ADMIN_PASSWORD`
> are not both set, the seed creates no admin at all.

## 3. Run migrations + seed the first admin

The Dockerfile's start command runs the server only — it does **not** run
migrations. Run these once against the production database (Railway shell, a
one-off command, or a release step):

```bash
# Apply schema (production-safe, never resets data)
npx prisma migrate deploy

# Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
npx prisma db seed
```

To automate on every deploy, add a release/pre-deploy command in Railway:

```bash
npx prisma migrate deploy
```

Keep the **seed as a manual one-off** — you only need it once to bootstrap the
first admin. After that, add the other owner/operator accounts from the app at
**/users** (Admin only).

## 4. First login & user setup

1. Visit `AUTH_URL`, log in as the bootstrap admin.
2. Go to **/users** and create the remaining accounts:
   - Owners → role **ADMIN**
   - Operators → role **OPERATOR**
3. (Recommended) After all admins exist, remove `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   from Railway so a stray `db seed` can't recreate the bootstrap account.

---

## Roles

Two roles, gated by route prefix in [`src/auth.config.ts`](src/auth.config.ts):

- **ADMIN** — full access.
- **OPERATOR** — everything except `/reports`, `/settings`, `/users`
  (redirected to `/production`).

To change what operators can access, edit the `ADMIN_PREFIXES` array in that
file — it's the single source of truth for role gating.

---

## Notes

- **Passwords survive dumps.** Credentials are stored as bcrypt hashes, which are
  environment-agnostic — no re-hashing needed if you ever `pg_dump` → restore.
- **`migrate deploy` vs `migrate dev`.** Always use `migrate deploy` in
  production. Never run `migrate dev` or `prisma db push --force-reset` against
  the production database.
- **Backups.** Enable Railway's Postgres backups before the business starts
  entering real data.
