// Seeds only the bootstrap admin user for a fresh deployment. All business
// data (customers, suppliers, contractor rates/opening balances, etc.) is
// entered through the app UI — nothing is pre-seeded.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Bootstrap admin is created only when ADMIN_EMAIL + ADMIN_PASSWORD are
  // explicitly provided (e.g. first deploy on a fresh DB). No hardcoded
  // default account is seeded.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: process.env.ADMIN_NAME ?? "Admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: "ADMIN",
      },
    });
    console.log(`Admin user: ${admin.email}`);
  } else {
    console.log("No ADMIN_EMAIL/ADMIN_PASSWORD set — skipping admin seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
