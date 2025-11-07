-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leader" TEXT,
    "deputy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'UNIT_LEAD',
    "unitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "exitDate" DATETIME,
    "unitId" TEXT,
    "lockAll" BOOLEAN NOT NULL DEFAULT false,
    "lockFirstName" BOOLEAN NOT NULL DEFAULT false,
    "lockLastName" BOOLEAN NOT NULL DEFAULT false,
    "lockStartDate" BOOLEAN NOT NULL DEFAULT false,
    "lockBirthDate" BOOLEAN NOT NULL DEFAULT false,
    "lockEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("birthDate", "createdAt", "email", "firstName", "id", "lastName", "lockAll", "lockBirthDate", "lockEmail", "lockFirstName", "lockLastName", "lockStartDate", "startDate", "updatedAt") SELECT "birthDate", "createdAt", "email", "firstName", "id", "lastName", "lockAll", "lockBirthDate", "lockEmail", "lockFirstName", "lockLastName", "lockStartDate", "startDate", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE UNIQUE INDEX "Employee_firstName_lastName_birthDate_key" ON "Employee"("firstName", "lastName", "birthDate");
CREATE TABLE "new_Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "managerEmails" TEXT NOT NULL DEFAULT '',
    "birthdayEmailTemplate" TEXT NOT NULL DEFAULT 'Happy Birthday, {{firstName}}!',
    "jubileeEmailTemplate" TEXT NOT NULL DEFAULT 'Congrats on {{years}} years, {{firstName}}!',
    "jubileeYearsCsv" TEXT NOT NULL DEFAULT '5,10,15,20,25,30,35,40',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPass" TEXT NOT NULL DEFAULT '',
    "smtpFrom" TEXT NOT NULL DEFAULT '',
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpRejectUnauthorized" BOOLEAN NOT NULL DEFAULT true,
    "sendOnBirthday" BOOLEAN NOT NULL DEFAULT true,
    "sendOnJubilee" BOOLEAN NOT NULL DEFAULT true,
    "dailySendHour" INTEGER NOT NULL DEFAULT 8
);
INSERT INTO "new_Setting" ("birthdayEmailTemplate", "id", "jubileeEmailTemplate", "jubileeYearsCsv", "managerEmails") SELECT "birthdayEmailTemplate", "id", "jubileeEmailTemplate", "jubileeYearsCsv", "managerEmails" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
