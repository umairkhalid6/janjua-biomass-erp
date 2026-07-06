# Janjua Biomass ERP

An internal ERP system for managing production, sales, purchases, and inventory
for a biomass pellet manufacturing business.

---

## Overview

<!-- TODO: Expand with a 2–3 sentence description of the business and what this app tracks -->

Key features (planned):
- Production run logging (bags manufactured, feedstock consumed)
- Sales management (customers, invoices, bag counts)
- Purchase management (feedstock, vendors, weights in KG)
- Inventory snapshots
- Role-based access (ADMIN / OPERATOR)
- Mobile-accessible UI for on-site data entry

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Auth | Auth.js v5 |
| Containerisation | Docker Compose (local) |
| Deployment | Railway / Render |

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd janjua-biomass-erp

# 2. Set up environment
cp .env.example .env
# Edit .env and set a strong AUTH_SECRET (openssl rand -base64 32)

# 3. Start services
docker compose up --build

# 4. Run migrations (first time)
docker compose exec app npx prisma migrate deploy

# 5. Seed initial admin user
docker compose exec app npx prisma db seed

# App is now available at http://localhost:3000
```

---

## Development (without Docker)

```bash
# Requires: Node 22+, a running PostgreSQL instance

npm install

# Set DATABASE_URL in .env to point to your local Postgres
# (use the localhost form — see .env.example)

npx prisma generate
npx prisma migrate dev

npm run dev
# → http://localhost:3000
```

---

## Database & Migrations

```bash
# Create a new migration after editing prisma/schema.prisma
npx prisma migrate dev --name <description>

# Apply migrations in production
npx prisma migrate deploy

# Seed the database
npx prisma db seed

# Open Prisma Studio (visual database browser)
npx prisma studio
```

---

## Deployment (Railway / Render)

<!-- TODO: Expand with step-by-step Railway and Render deployment guides -->

General approach:
1. Set all env vars from `.env.example` in the platform's dashboard.
2. Set `DATABASE_URL` to the platform's managed Postgres connection string.
3. The `Dockerfile` builds a standalone Next.js image — point the platform to it.
4. On first deploy, run `npx prisma migrate deploy` via the platform's shell or a release command.

---

## Phone Access

<!-- TODO: Document how operators access the app from mobile on-site
     (e.g., local network URL, PWA setup, responsive design notes) -->

The UI is designed to be mobile-friendly. Operators can access it from any
device on the same network by navigating to `http://<server-ip>:3000`.

---

## Environment Variables

See `.env.example` for a full list with comments.
