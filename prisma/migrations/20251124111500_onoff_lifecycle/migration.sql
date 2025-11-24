-- On/Offboarding lifecycle models

-- Enums
CREATE TYPE "TaskType" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "LifecycleOwnerRole" AS ENUM ('HR','IT','ADMIN','UNIT_LEAD','TEAM_LEAD','PEOPLE_MANAGER');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN','COMPLETED','CANCELLED');

-- Tables
CREATE TABLE "LifecycleTemplate" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "type" "TaskType" NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LifecycleTemplate_title_type_key" ON "LifecycleTemplate"("title","type");

CREATE TABLE "LifecycleTaskTemplate" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerRole" "LifecycleOwnerRole" NOT NULL,
  "relativeDays" INTEGER NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "LifecycleTaskTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LifecycleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LifecycleProcess" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "type" "TaskType" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "LifecycleProcess_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LifecycleProcess_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LifecycleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LifecycleProcess_employeeId_idx" ON "LifecycleProcess"("employeeId");

CREATE TABLE "LifecycleTask" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerRole" "LifecycleOwnerRole" NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LifecycleTask_processId_fkey" FOREIGN KEY ("processId") REFERENCES "LifecycleProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LifecycleTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LifecycleTask_processId_idx" ON "LifecycleTask"("processId");
