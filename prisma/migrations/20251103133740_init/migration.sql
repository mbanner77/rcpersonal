-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "lockAll" BOOLEAN NOT NULL DEFAULT FALSE,
    "lockFirstName" BOOLEAN NOT NULL DEFAULT FALSE,
    "lockLastName" BOOLEAN NOT NULL DEFAULT FALSE,
    "lockStartDate" BOOLEAN NOT NULL DEFAULT FALSE,
    "lockBirthDate" BOOLEAN NOT NULL DEFAULT FALSE,
    "lockEmail" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "managerEmails" TEXT NOT NULL DEFAULT '',
    "birthdayEmailTemplate" TEXT NOT NULL DEFAULT 'Happy Birthday, {{firstName}}!',
    "jubileeEmailTemplate" TEXT NOT NULL DEFAULT 'Congrats on {{years}} years, {{firstName}}!',
    "jubileeYearsCsv" TEXT NOT NULL DEFAULT '5,10,15,20,25,30,35,40',
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_firstName_lastName_birthDate_key" ON "Employee"("firstName", "lastName", "birthDate");
