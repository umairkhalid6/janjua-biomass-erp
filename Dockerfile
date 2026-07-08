# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the app
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before building
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Prisma CLI for Railway's preDeployCommand. A standalone install so
# the CLI's full dependency tree exists without shipping the app's
# node_modules; version tracks package.json.
FROM node:22-alpine AS migrate
# openssl must be present at install time: @prisma/engines detects the
# platform's OpenSSL to choose which schema-engine binary to download.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /migrate
COPY package.json ./app-package.json
RUN npm install --no-save "prisma@$(node -p "require('./app-package.json').dependencies.prisma")" \
    && rm app-package.json package.json 2>/dev/null; true

# Stage 4: Production runner
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma schema and migrations (needed for runtime if using migrate deploy)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Self-contained migration toolkit for Railway's preDeployCommand
# (`cd /migrate && node node_modules/prisma/build/index.js migrate deploy`).
# Prisma 7 reads the datasource URL from prisma.config.ts, so the config,
# schema, migrations, and the full CLI dependency tree all live here —
# isolated from the app's standalone node_modules.
COPY --from=migrate /migrate/node_modules /migrate/node_modules
COPY --from=builder /app/prisma.config.ts /migrate/prisma.config.ts
COPY --from=builder /app/prisma /migrate/prisma

# Railway's preDeployCommand is NOT run through a shell (&&/cd/redirects are
# passed as literal argv), so the whole migrate step lives in this script and
# preDeployCommand is just: /bin/sh /migrate/deploy.sh
RUN printf '#!/bin/sh\nset -e\ncd /migrate\nexec node node_modules/prisma/build/index.js migrate deploy 2>&1\n' > /migrate/deploy.sh \
    && chmod +x /migrate/deploy.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
