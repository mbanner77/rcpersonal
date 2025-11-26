-- Create Reminder related tables

CREATE TYPE "ReminderType" AS ENUM ('GEHALT','MEILENSTEIN','SONDERBONUS','STAFFELBONUS','URLAUBSGELD','WEIHNACHTSGELD');

CREATE TABLE "Reminder" (
  "id" TEXT PRIMARY KEY,
  "type" "ReminderType" NOT NULL,
  "description" TEXT,
  "employeeId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Reminder_employeeId_dueDate_idx" ON "Reminder" ("employeeId","dueDate");

CREATE TABLE "ReminderSchedule" (
  "id" TEXT PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "timeOfDay" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ReminderSchedule_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReminderSchedule_reminderId_idx" ON "ReminderSchedule" ("reminderId");

CREATE TABLE "ReminderRecipient" (
  "id" TEXT PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ReminderRecipient_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReminderRecipient_reminderId_idx" ON "ReminderRecipient" ("reminderId");
