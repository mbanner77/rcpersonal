-- CreateEnum (with IF NOT EXISTS via DO block)
DO $$ BEGIN
    CREATE TYPE "AssetCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'TABLET', 'KEYBOARD', 'MOUSE', 'HEADSET', 'DOCKING_STATION', 'PRINTER', 'CAMERA', 'PROJECTOR', 'FURNITURE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssetStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'TRANSFER_PENDING', 'SOLD', 'DISPOSED', 'LOST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssetTransferType" AS ENUM ('SALE', 'GIFT', 'RETURN', 'REASSIGNMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssetTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Asset - Add new columns (idempotent)
DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "assetTag" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "description" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "category" "AssetCategory" NOT NULL DEFAULT 'OTHER';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "manufacturer" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "model" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "purchaseDate" TIMESTAMP(3);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "purchasePrice" DECIMAL(10,2);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "currentValue" DECIMAL(10,2);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "warrantyEnd" TIMESTAMP(3);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "status" "AssetStatus" NOT NULL DEFAULT 'IN_STOCK';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Asset" ADD COLUMN "assignedAt" TIMESTAMP(3);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateTable AssetTransfer
CREATE TABLE IF NOT EXISTS "AssetTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AssetTransferType" NOT NULL,
    "status" "AssetTransferStatus" NOT NULL DEFAULT 'PENDING',
    "originalValue" DECIMAL(10,2),
    "depreciatedValue" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "employeeAccepted" BOOLEAN NOT NULL DEFAULT false,
    "employeeAcceptedAt" TIMESTAMP(3),
    "employeeSignature" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "agreementPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssetTransfer_transferNumber_key" ON "AssetTransfer"("transferNumber");
CREATE INDEX IF NOT EXISTS "AssetTransfer_assetId_idx" ON "AssetTransfer"("assetId");
CREATE INDEX IF NOT EXISTS "AssetTransfer_employeeId_idx" ON "AssetTransfer"("employeeId");
CREATE INDEX IF NOT EXISTS "AssetTransfer_status_idx" ON "AssetTransfer"("status");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
