// Seeds the first admin user and the contractor (Thekadar) opening state
// carried over from the Google Sheets workbook (claude-code-copy-biomass.xlsx).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Thekadar rate from the sheet: 6 PKR per KG of pellets produced.
  await prisma.contractorRate.upsert({
    where: { effectiveFrom: new Date("2026-05-01") },
    update: {},
    create: { effectiveFrom: new Date("2026-05-01"), ratePerKg: 6 },
  });
  console.log("Contractor rate: 6 PKR/kg effective 2026-05-01");

  // Opening balances from the sheet's "Thekadar credit/balance History"
  // (485,770 + 18,960 = 504,730 PKR owed to the contractor).
  const adjustments = [
    {
      date: new Date("2026-05-31"),
      amount: 485770,
      reason: "Opening balance carried from May 2026 sheet",
    },
    {
      date: new Date("2026-06-30"),
      amount: 18960,
      reason: "June 2026 balance carried from sheet",
    },
  ];
  for (const adj of adjustments) {
    await prisma.contractorAdjustment.upsert({
      where: { date_reason: { date: adj.date, reason: adj.reason } },
      update: {},
      create: adj,
    });
  }
  console.log("Contractor opening balance seeded (total 504,730 PKR owed)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
