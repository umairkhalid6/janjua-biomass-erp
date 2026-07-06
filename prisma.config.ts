// Prisma v7 configuration file
// Connection URL is read from the DATABASE_URL environment variable.
// See .env.example for all required variables.
//
// In local dev the URL lives in .env and is loaded via dotenv. In production
// (Railway, etc.) the platform injects DATABASE_URL directly, and the runtime
// image may not include dotenv — so the load is best-effort and must never
// crash config resolution (a thrown import here leaves datasource.url unset,
// which fails `prisma migrate deploy`).
import { defineConfig } from "prisma/config";

if (!process.env["DATABASE_URL"]) {
  try {
    await import("dotenv/config");
  } catch {
    // dotenv unavailable — rely on the platform-injected environment.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
