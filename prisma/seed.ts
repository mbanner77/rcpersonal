import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@realcore.de").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "RealCore2025!";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      managerEmails: "",
    },
  });

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`[seed] Created default admin ${adminEmail}`);
  } else {
    console.log(`[seed] Admin ${adminEmail} already exists, skipping creation.`);
  }
}

main()
  .then(() => console.log("[seed] Complete."))
  .catch((error) => {
    console.error("[seed] Error seeding database:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
