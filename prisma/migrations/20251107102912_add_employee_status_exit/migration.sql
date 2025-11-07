-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'UNIT_LEAD');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leader" TEXT,
    "deputy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'UNIT_LEAD',
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "exitDate" TIMESTAMP(3),
    "unitId" TEXT,
    "lockAll" BOOLEAN NOT NULL DEFAULT false,
    "lockFirstName" BOOLEAN NOT NULL DEFAULT false,
    "lockLastName" BOOLEAN NOT NULL DEFAULT false,
    "lockStartDate" BOOLEAN NOT NULL DEFAULT false,
    "lockBirthDate" BOOLEAN NOT NULL DEFAULT false,
    "lockEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
INSERT INTO "new_Employee" ("birthDate", "createdAt", "email", "firstName", "id", "lastName", "lockAll", "lockBirthDate", "lockEmail", "lockFirstName", "lockLastName", "lockStartDate", "startDate", "updatedAt") SELECT "birthDate", "createdAt", "email", "firstName", "id", "lastName", "lockAll", "lockBirthDate", "lockEmail", "lockFirstName", "lockLastName", "lockStartDate", "startDate", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineTables
CREATE TABLE "new_Setting" (
    "id" SERIAL NOT NULL,
    "managerEmails" TEXT NOT NULL DEFAULT '',
    "birthdayEmailTemplate" TEXT NOT NULL DEFAULT 'Happy Birthday, {{firstName}}!',
    "jubileeEmailTemplate" TEXT NOT NULL DEFAULT 'Congrats on {{years}} years, {{firstName}}!',
    "jubileeYearsCsv" TEXT NOT NULL DEFAULT '5,10,15,20,25,30,35,40',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPass" TEXT NOT NULL DEFAULT '',
    "smtpFrom" TEXT NOT NULL DEFAULT '',
    "smtpSecure" BOOLEAN NOT NULL DEFAULT TRUE,
    "smtpRejectUnauthorized" BOOLEAN NOT NULL DEFAULT TRUE,
    "sendOnBirthday" BOOLEAN NOT NULL DEFAULT TRUE,
    "sendOnJubilee" BOOLEAN NOT NULL DEFAULT TRUE,
    "dailySendHour" INTEGER NOT NULL DEFAULT 8,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
INSERT INTO "new_Setting" ("birthdayEmailTemplate", "id", "jubileeEmailTemplate", "jubileeYearsCsv", "managerEmails") SELECT "birthdayEmailTemplate", "id", "jubileeEmailTemplate", "jubileeYearsCsv", "managerEmails" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
