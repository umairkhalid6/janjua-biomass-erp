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
  // Normalize the email exactly like the login path (auth.ts authorize()
  // lowercases + trims). Storing it any other way means a correct password is
  // rejected at login with "Invalid email or password".
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    // Upsert also refreshes the password/name/role/active on re-run, so this
    // doubles as a safe "reset the bootstrap admin" command if the account was
    // seeded with the wrong casing or the password was forgotten.
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: process.env.ADMIN_NAME ?? "Admin",
        passwordHash,
        role: "ADMIN",
        active: true,
      },
      create: {
        name: process.env.ADMIN_NAME ?? "Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Admin user ready: ${admin.email}`);
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
