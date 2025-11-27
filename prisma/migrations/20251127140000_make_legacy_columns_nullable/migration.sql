-- Make legacy columns nullable (they have NOT NULL constraint from original enum definitions)
-- This allows Prisma to insert records without needing the old enum values

-- TaskAssignment.ownerRole (was LifecycleOwnerRole enum)
ALTER TABLE "TaskAssignment" ALTER COLUMN "ownerRole" DROP NOT NULL;

-- TaskAssignment.status (was TaskStatus enum)
ALTER TABLE "TaskAssignment" ALTER COLUMN "status" DROP NOT NULL;
