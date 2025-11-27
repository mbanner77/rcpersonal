-- Note: The existing "ReminderType" enum in the database is kept as-is.
-- The Prisma schema maps it as ReminderTypeEnum with @@map("ReminderType").
-- The new table is named "ReminderTypeConfig" to avoid conflict with the enum.

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "ReminderTypeConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderTypeConfig_key_key" ON "ReminderTypeConfig"("key");

-- AddColumn (nullable to allow existing data)
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "reminderTypeId" TEXT;

-- AddForeignKey (only if column exists and has values)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Reminder_reminderTypeId_fkey'
    ) THEN
        ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_reminderTypeId_fkey" 
        FOREIGN KEY ("reminderTypeId") REFERENCES "ReminderTypeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Insert default ReminderTypeConfig entries
INSERT INTO "ReminderTypeConfig" ("id", "key", "label", "description", "color", "orderIndex", "active", "createdAt", "updatedAt")
VALUES 
    (gen_random_uuid()::text, 'GEHALT', 'Gehalt', 'Gehaltserhöhungen und -anpassungen', 'emerald', 0, true, NOW(), NOW()),
    (gen_random_uuid()::text, 'MEILENSTEIN', 'Meilenstein', 'Wichtige Ereignisse und Jubiläen', 'blue', 1, true, NOW(), NOW()),
    (gen_random_uuid()::text, 'SONDERBONUS', 'Sonderbonus', 'Einmalige Bonuszahlungen', 'purple', 2, true, NOW(), NOW()),
    (gen_random_uuid()::text, 'STAFFELBONUS', 'Staffelbonus', 'Gestaffelte Bonuszahlungen', 'orange', 3, true, NOW(), NOW()),
    (gen_random_uuid()::text, 'URLAUBSGELD', 'Urlaubsgeld', 'Jährliche Urlaubsgeldzahlung', 'indigo', 4, true, NOW(), NOW()),
    (gen_random_uuid()::text, 'WEIHNACHTSGELD', 'Weihnachtsgeld', 'Jährliche Weihnachtsgeldzahlung', 'red', 5, true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Update existing Reminders to link to ReminderTypeConfig based on legacy "type" column
UPDATE "Reminder" r
SET "reminderTypeId" = rt.id
FROM "ReminderTypeConfig" rt
WHERE r."type"::text = rt."key" AND r."reminderTypeId" IS NULL;
