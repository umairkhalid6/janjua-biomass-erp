# Janjua Biomass ERP

A Progressive Web App (PWA) for managing production, sales, purchases, inventory, and financials for a biomass pellet manufacturing business. Built with modern web standards to support both browser and offline-capable mobile access.

---

## Overview

Janjua Biomass ERP replaces spreadsheet-based tracking with a purpose-built application that handles:

- **Production Runs** — Log daily batch production (bags manufactured, feedstock consumed)
- **Sales Management** — Record customer orders, generate invoices with auto-incrementing invoice numbers
- **Purchase Management** — Track feedstock purchases from vendors by weight (KG)
- **Inventory Snapshots** — Monitor stock levels and material flows
- **Financial Reports** — Profit & Loss, production trends, material costs, contractor ledger, customer/vendor ledgers
- **User Management** — Role-based access control (ADMIN / OPERATOR)
- **Mobile Access** — Works on-site on phones via local network, with PWA installation for offline fallback

The app tracks production in 40-kg bags and purchases in kilograms, with all financial amounts in Pakistani Rupees (PKR). Data is always fresh — caching is restricted to the app shell and static assets only; financial data is never cached.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **Styling** | Tailwind CSS v4 |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma 7 (with pg driver adapter) |
| **Authentication** | Auth.js v5 (Credentials provider, JWT sessions) |
| **Charts** | Recharts 3.9 |
| **PWA** | Hand-rolled service worker (`public/sw.js`) — static assets only |
| **Containerisation** | Docker Compose (local) |
| **Deployment** | Railway or Render (managed Postgres) |

---

## Quick Start (Docker)

### Prerequisites
- Docker and Docker Compose installed
- ~5 minutes to first login

### Steps

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd janjua-biomass-erp

# 2. Copy environment template and edit
cp .env.example .env

# 3. Generate a strong AUTH_SECRET
openssl rand -base64 32
# Copy the output and paste into .env under AUTH_SECRET

# 4. Start the services
docker compose up --build

# 5. In another terminal, run migrations and seed
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed

# App is now running at http://localhost:${APP_PORT} (default 3000;
# on this machine .env sets APP_PORT=3010 because 3000/3001 are taken)
# Login with: admin@example.com / changeme
```

### Important: Local Database Port

On this machine, the PostgreSQL container is exposed on **host port 5433** (not the standard 5432) because a native Postgres instance already occupies 5432. Inside the Docker container, the app still connects to `postgres:5432` normally — the port mapping is transparent to the app.

If you're running `npm run dev` against the compose database from the host:
- Use `DATABASE_URL="postgresql://erp:changeme@localhost:5433/biomass_erp?schema=public"`

---

## Development (Local)

### Without Docker

```bash
# Prerequisites: Node 22+, PostgreSQL running on localhost:5433

npm install

# Configure .env
cp .env.example .env
# Edit .env to set DATABASE_URL to your local Postgres:
# DATABASE_URL="postgresql://erp:changeme@localhost:5433/biomass_erp?schema=public"

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed test data
npx prisma db seed

# Start dev server
npm run dev
# → http://localhost:3000
```

### Prisma Workflow

```bash
# After editing prisma/schema.prisma, create a migration
npx prisma migrate dev --name <description>

# Open Prisma Studio (GUI database browser)
npx prisma studio

# Deploy migrations in production
npx prisma migrate deploy

# Re-seed the database
npx prisma db seed
```

---

## Using the App

### Roles

- **ADMIN** — Full access: user management, all settings, all reports, all CRUD operations, financial summaries. Access admin-only sections via `/settings`, `/users`, `/reports`.
- **OPERATOR** — Day-to-day data entry: log production runs, record sales, enter purchases. No access to reports or user management. Sees only shortcuts for quick entry.

### Key Pages

| Page | Purpose | Role |
|------|---------|------|
| `/` (Dashboard) | Overview: today's production, current-month metrics, 6-month profit trend | ADMIN sees summary; OPERATOR sees production shortcut |
| `/production` | Upsert daily production (bags, feedstock, day/night split) | OPERATOR+ |
| `/sales` | Record customer sales, generate invoices | OPERATOR+ |
| `/purchases` | Record material purchases by feedstock type | OPERATOR+ |
| `/customers` | Manage customer list (name, contact) | OPERATOR+ |
| `/vendors` | Manage vendor list (raw material suppliers) | OPERATOR+ |
| `/electricity` | Monthly electricity cost entry | OPERATOR+ |
| `/expenses` | General expense tracking (maintenance, etc.) | OPERATOR+ |
| `/contractor` | Manage contractor/Thekadar balance and payments | OPERATOR+ |
| `/reports` | Landing page for all financial reports | ADMIN |
| `/reports/pnl` | Profit & Loss summary and 12-month history | ADMIN |
| `/reports/production` | Daily production details and trends | ADMIN |
| `/reports/materials` | Material costs and 6-month stacked cost chart | ADMIN |
| `/reports/contractor` | Running balance ledger with earned vs. paid | ADMIN |
| `/reports/customers` | Customer ledger (sales + payments) | ADMIN |
| `/reports/vendors` | Vendor ledger (purchases + payments) | ADMIN |
| `/users` | Create/manage admin and operator users | ADMIN |
| `/settings` | Configure system settings (contractor rate history) | ADMIN |

### Invoices

Each sale generates an invoice with a unique auto-incrementing number. Access it via:
- `/sales` → click a sale row → view the "Invoice" button or go directly to `/sales/[id]/invoice`
- The invoice page is printable (use your browser's print function)

---

## Adding Users

1. Log in as ADMIN
2. Navigate to `/users`
3. Click "Create User"
4. Enter email and set an initial password
5. Save — the new user can log in and must change their password on first login

---

## Phone Access

The app is fully responsive and works on mobile devices. There are two ways to access it from a phone on-site:

### Option A: Local Network (Simplest)

1. **Find your Mac's LAN IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
   ```
   (Look for something like `192.168.1.100` or `10.0.0.50`)

2. **On your phone browser:** Navigate to `http://<mac-ip>:3000`
   - Example: `http://192.168.1.100:3000`

3. **Install as PWA (optional but recommended):**
   - **iPhone (Safari):** Tap Share → "Add to Home Screen" → "Add"
   - **Android (Chrome):** Tap menu (⋮) → "Install app" or "Add to Home Screen"
   - The app will appear as a native-looking icon, work offline for the app shell, and always fetch fresh financial data

4. **Note:** For consistent LAN access, ensure `AUTH_URL` in `.env` includes the LAN IP, or leave it as `http://localhost:3000` for development (browsers will handle it). In production, set `AUTH_URL` to the public deployed URL.

### Option B: Remote Access via Tailscale

For secure access away from home:

1. Install [Tailscale](https://tailscale.com/) on your Mac and phone
2. Activate Tailscale on both devices
3. Your Mac will get a Tailscale IP (e.g., `100.x.x.x`)
4. On your phone, navigate to `http://<tailscale-ip>:3000`

---

## PWA Features

The app is a Progressive Web App, which means:

- **Installable** — Add to home screen on phones (iOS/Android) and get an app-like experience
- **Responsive** — Adapts to all screen sizes automatically
- **Fast** — The app shell (UI structure) is cached; navigation is instant
- **Fresh Data** — Financial data (/api/*, pages with forms) is always fetched live — it is **never cached**. You never see stale financials
- **Works Offline** — The app shell loads from cache; you can view past pages, but data entries require a network connection

### Installing on Your Phone

**iPhone (Safari):**
1. Open the app in Safari
2. Tap the Share button (↗️)
3. Scroll and tap "Add to Home Screen"
4. Name it "Biomass ERP" (or leave default)
5. Tap "Add"
6. The icon will appear on your home screen — tap to open as a fullscreen app

**Android (Chrome):**
1. Open the app in Chrome
2. Tap the three-dot menu (⋮)
3. Tap "Install app" (or "Add to Home Screen" if "Install app" is unavailable)
4. Confirm the installation
5. The icon will appear on your home screen

Once installed:
- The app opens fullscreen without the browser address bar
- It feels like a native app
- You can use it offline for viewing cached content (the app shell and forms)
- Any attempt to submit data will require a network connection

---

## Deployment

### Railway (Recommended)

Railway offers the simplest experience for this stack: Git-connected deployment, managed Postgres, automatic Dockerfile detection, and usage-based pricing (ideal for single-user internal tools).

**Setup steps:**

1. **Create a Railway project** at [railway.app](https://railway.app)
2. **Connect your GitHub repo** (or upload the Dockerfile directly)
3. **Add a Postgres plugin:**
   - In the Railway dashboard, click "+ Add Service" → "Postgres"
   - Railway auto-creates the database and injects `DATABASE_URL`
4. **Set environment variables:**
   - Click "Add Variable" and set:
     - `AUTH_SECRET` — generate with `openssl rand -base64 32`
     - `AUTH_URL` — set to your Railway domain (e.g., `https://myapp-prod.up.railway.app`)
     - `NODE_ENV` — set to `production`
     - Other vars from `.env.example` (ADMIN_EMAIL, ADMIN_PASSWORD, etc.)
5. **Deploy:**
   - Push to your connected GitHub branch, or click "Deploy" in the dashboard
   - Railway detects the `Dockerfile` and builds/deploys automatically
6. **On first deploy, run migrations:**
   ```bash
   railway run npx prisma migrate deploy
   railway run npx prisma db seed
   ```
   Or use Railway's "Run" tab in the dashboard to execute shell commands

7. **Access the app:** Navigate to your Railway URL (e.g., `https://myapp-prod.up.railway.app`)

### Render (Alternative)

Render also works well; the main difference is that the free Postgres tier expires after 30 days. For a production app, upgrade to a paid plan.

**Setup steps:**

1. **Create a Web Service** at [render.com](https://render.com)
2. **Connect your GitHub repo**
3. **Add a Postgres database:**
   - Create a new PostgreSQL service
   - Render provides a `DATABASE_URL` connection string
4. **Link the database to your Web Service:**
   - In the service settings, set `DATABASE_URL` env var to the Postgres URL
5. **Set other environment variables:**
   - `AUTH_SECRET`, `AUTH_URL`, `NODE_ENV`, etc. (same as Railway)
6. **Build/Deploy:**
   - Render auto-detects the `Dockerfile`
   - Deployment triggers on git push
7. **Manually run migrations:**
   - Use Render's shell to execute:
     ```bash
     npx prisma migrate deploy
     npx prisma db seed
     ```

### General Notes

- Both platforms support the `standalone` Next.js build output (set in `next.config.ts`)
- The `Dockerfile` is production-ready: 3-stage build, non-root user, minimal Alpine base
- Prisma migrations work identically in production — `prisma migrate deploy` applies all pending migrations in order
- Database backups: Both Railway and Render offer automated backups; configure in their dashboards

---

## Security & First Login

### Initial Setup

After first deploy or seed, an ADMIN user is created with:
- **Email:** `ADMIN_EMAIL` from `.env` (default: `admin@example.com`)
- **Password:** `ADMIN_PASSWORD` from `.env` (default: `changeme`)

**On first login:**
1. Log in with the default credentials
2. Immediately change your password (navigate to `/users`, edit your account, or look for a settings/profile option)
3. Create additional operator accounts as needed

### Best Practices

- **Change default passwords immediately** — don't leave the app accessible with `changeme`
- **Auth.js JWT Sessions** — sessions are stateless tokens stored in cookies; they expire after a fixed period (configured in auth.config.ts). No session table to manage.
- **HTTPS in Production** — ensure `AUTH_URL` uses `https://` for production deployments; browsers block auth cookies over HTTP (except localhost)
- **Environment Variables** — never commit `.env` to git; keep `AUTH_SECRET` and `AUTH_URL` in your deployment platform's secrets

---

## Building

```bash
npm run build
```

This:
1. Compiles Next.js (TypeScript, JSX, etc.)
2. Generates the Prisma client
3. Produces a `standalone` Next.js build in `.next/standalone/`
4. Copies `public/` (including the static service worker `sw.js` and PWA manifest) into the standalone output

The output is ready for Docker or direct Node.js execution.

---

## Troubleshooting

### "Connection refused" to Postgres

- **In Docker:** Ensure `docker compose up` is running and postgres health check passed (`docker compose ps` shows `healthy`)
- **Local dev:** Check `DATABASE_URL` in `.env` points to `localhost:5433` and Postgres is running

### "No seed command configured"

- Prisma 7 moved seed config to `prisma.config.ts`, not `package.json`
- Ensure `prisma.config.ts` exists and includes `migrations.seed: "npx tsx prisma/seed.ts"`

### "Auth middleware not defined"

- Next 16 renames middleware to "proxy" (see deprecation warning)
- Current code uses `src/middleware.ts` with `export default auth` — this is valid; the warning is cosmetic
- Future versions may require renaming to `src/proxy.ts`

### Mobile: "Install as App" not available

- Ensure `manifest.json` is served correctly (check Network tab in DevTools)
- Ensure `AUTH_URL` is correctly set (Chrome/Safari verify the origin before allowing install)
- On iPhone, PWA install is not available in Chrome; use Safari instead

---

## Development Notes

### Schema & Migrations

- All models in `prisma/schema.prisma`
- Migrations auto-generated by `prisma migrate dev` and stored in `prisma/migrations/`
- SQL views (for reports) are defined directly in migration `.sql` files and cannot be edited in schema.prisma; query them with `prisma.$queryRaw`

### Report Views

Reports are powered by SQL views (e.g., `v_monthly_summary`, `v_contractor_ledger`) created in migrations. Data is always queried live; nothing is cached.

### Form Patterns

- Pages are server components; client forms live in `*-forms.tsx`
- Actions use `useActionState<ActionState>()` and `useFormStatus` for spinners
- Always call `requireUser()` or `requireAdmin()` at the top of server actions
- Always call `revalidatePath()` after mutations to refresh data
- Serialize Prisma `Decimal` values with `.toNumber()` before sending to clients

### Adding New Pages

1. Create `src/app/(app)/<route>/page.tsx` (server component)
2. Add nav item to `src/components/nav-items.ts`
3. If it's admin-only, set `adminOnly: true` on the nav item and add the prefix to `ADMIN_PREFIXES` in `src/auth.config.ts`
4. Use server actions in a co-located `actions.ts` and form components in `*-forms.tsx`

---

## Memory & Decisions

This codebase includes two reference documents:

- **MEMORY.md** — Project decisions, domain vocabulary, tech stack notes, and conventions for future developers
- **ERRORS.md** — A log of tricky bugs and their fixes (invaluable for debugging similar issues)

Read them if you're extending the codebase.

---

## License

Internal use only. Janjua Biomass.
