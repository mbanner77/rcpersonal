-- Create ReminderSendLog for tracking sent reminder emails

CREATE TABLE IF NOT EXISTS "ReminderSendLog" (
  "id" TEXT PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "scheduleLabel" TEXT NOT NULL,
  "targetEmail" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReminderSendLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReminderSendLog_reminderId_sentAt_idx" ON "ReminderSendLog" ("reminderId","sentAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderSendLog_unique_target" ON "ReminderSendLog" ("reminderId","scheduleLabel","targetEmail","sentAt");
