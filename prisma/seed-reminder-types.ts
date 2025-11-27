import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_REMINDER_TYPES = [
  { key: "GEHALT", label: "Gehalt", description: "Gehaltserhöhungen und -anpassungen", color: "emerald", orderIndex: 0 },
  { key: "MEILENSTEIN", label: "Meilenstein", description: "Wichtige Ereignisse und Jubiläen", color: "blue", orderIndex: 1 },
  { key: "SONDERBONUS", label: "Sonderbonus", description: "Einmalige Bonuszahlungen", color: "amber", orderIndex: 2 },
  { key: "STAFFELBONUS", label: "Staffelbonus", description: "Gestaffelte Bonuszahlungen", color: "orange", orderIndex: 3 },
  { key: "URLAUBSGELD", label: "Urlaubsgeld", description: "Jährliche Urlaubsgeldzahlung", color: "indigo", orderIndex: 4 },
  { key: "WEIHNACHTSGELD", label: "Weihnachtsgeld", description: "Jährliche Weihnachtsgeldzahlung", color: "red", orderIndex: 5 },
];

async function seedReminderTypes() {
  console.log("Seeding reminder types...");

  for (const type of DEFAULT_REMINDER_TYPES) {
    const existing = await (prisma as any).reminderType.findUnique({
      where: { key: type.key },
    });

    if (!existing) {
      await (prisma as any).reminderType.create({
        data: type,
      });
      console.log(`  Created: ${type.label}`);
    } else {
      console.log(`  Exists: ${type.label}`);
    }
  }

  console.log("Done seeding reminder types.");
}

seedReminderTypes()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
