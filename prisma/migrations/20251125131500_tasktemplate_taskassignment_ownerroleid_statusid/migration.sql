-- Backfill TaskTemplate.ownerRoleId and TaskAssignment.ownerRoleId/statusId from previous enum columns

-- 1) TaskTemplate: add ownerRoleId, migrate, enforce, drop old
ALTER TABLE "TaskTemplate" ADD COLUMN "ownerRoleId" TEXT;

-- Map by key: LifecycleRole.key = previous enum value text
UPDATE "TaskTemplate" t
SET "ownerRoleId" = lr."id"
FROM "LifecycleRole" lr
WHERE lr."key" = t."ownerRole";

ALTER TABLE "TaskTemplate"
  ALTER COLUMN "ownerRoleId" SET NOT NULL;

ALTER TABLE "TaskTemplate"
  ADD CONSTRAINT "TaskTemplate_ownerRoleId_fkey"
  FOREIGN KEY ("ownerRoleId") REFERENCES "LifecycleRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old column after backfill
ALTER TABLE "TaskTemplate" DROP COLUMN "ownerRole";

-- 2) TaskAssignment: add ownerRoleId/statusId, migrate, enforce, drop old
ALTER TABLE "TaskAssignment" ADD COLUMN "ownerRoleId" TEXT;
ALTER TABLE "TaskAssignment" ADD COLUMN "statusId" TEXT;

-- Map ownerRole by key
UPDATE "TaskAssignment" ta
SET "ownerRoleId" = lr."id"
FROM "LifecycleRole" lr
WHERE lr."key" = ta."ownerRole";

-- Map status by key (assuming keys 'OPEN', 'DONE', 'BLOCKED')
UPDATE "TaskAssignment" ta
SET "statusId" = ls."id"
FROM "LifecycleStatus" ls
WHERE ls."key" = ta."status";

ALTER TABLE "TaskAssignment"
  ALTER COLUMN "ownerRoleId" SET NOT NULL,
  ALTER COLUMN "statusId" SET NOT NULL;

ALTER TABLE "TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_ownerRoleId_fkey"
  FOREIGN KEY ("ownerRoleId") REFERENCES "LifecycleRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "LifecycleStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment" DROP COLUMN "ownerRole";
ALTER TABLE "TaskAssignment" DROP COLUMN "status";

-- 3) Optional: drop old enum if no longer referenced
DO $$ BEGIN
  PERFORM 1 FROM pg_type WHERE typname = 'TaskStatus';
  IF FOUND THEN
    DROP TYPE "TaskStatus";
  END IF;
END $$;
