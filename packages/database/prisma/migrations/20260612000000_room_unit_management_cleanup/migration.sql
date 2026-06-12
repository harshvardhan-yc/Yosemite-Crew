-- AlterEnum
ALTER TYPE "RoomType" RENAME VALUE 'WAITING_AREA' TO 'WAITING';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'EXAM_ROOM';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'TREATMENT';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'DENTAL';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'IMAGING';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'GROOMING';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'INPATIENT';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'ISOLATION';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'BOARDING';
ALTER TYPE "RoomType" ADD VALUE IF NOT EXISTS 'RECEPTION';

-- CreateEnum
CREATE TYPE "RoomOccupancyStatus" AS ENUM ('VACANT', 'OCCUPIED');

-- AlterEnum
ALTER TYPE "RoomAvailabilityMode" RENAME VALUE 'DEFAULT' TO 'WORKING_HOURS';
ALTER TYPE "RoomAvailabilityMode" RENAME VALUE 'ALWAYS_ON' TO 'ALL_DAY';

-- AlterTable
ALTER TABLE "OrganisationRoom" DROP COLUMN IF EXISTS "fhirId";
ALTER TABLE "OrganisationRoom" DROP COLUMN "speciesConstraints";
ALTER TABLE "OrganisationRoom" ADD COLUMN "description" TEXT;
ALTER TABLE "OrganisationRoom" ADD COLUMN "occupancyStatus" "RoomOccupancyStatus" NOT NULL DEFAULT 'VACANT';

UPDATE "OrganisationRoom"
SET "code" = COALESCE(
  NULLIF("code", ''),
  'ROOM-' || SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8)
)
WHERE "code" IS NULL OR TRIM("code") = '';

ALTER TABLE "OrganisationRoom" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "OrganisationRoom" ALTER COLUMN "availabilityMode" SET DEFAULT 'ALL_DAY';

-- AlterTable
ALTER TABLE "RoomUnit" ADD COLUMN "unitGroupId" TEXT;

-- CreateTable
CREATE TABLE "RoomUnitGroup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "speciesConstraints" JSONB,
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomUnitGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DROP INDEX "OrganisationRoom_organisationId_availableNow_idx";

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationRoom_organisationId_code_key" ON "OrganisationRoom"("organisationId", "code");

-- CreateIndex
CREATE INDEX "OrganisationRoom_organisationId_type_idx" ON "OrganisationRoom"("organisationId", "type");

-- CreateIndex
CREATE INDEX "RoomUnit_unitGroupId_idx" ON "RoomUnit"("unitGroupId");

-- CreateIndex
CREATE INDEX "RoomUnitGroup_organisationId_idx" ON "RoomUnitGroup"("organisationId");

-- CreateIndex
CREATE INDEX "RoomUnitGroup_roomId_idx" ON "RoomUnitGroup"("roomId");

-- CreateIndex
CREATE INDEX "RoomUnitGroup_isActive_idx" ON "RoomUnitGroup"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RoomUnitGroup_roomId_name_key" ON "RoomUnitGroup"("roomId", "name");

-- AddForeignKey
ALTER TABLE "RoomUnit" ADD CONSTRAINT "RoomUnit_unitGroupId_fkey" FOREIGN KEY ("unitGroupId") REFERENCES "RoomUnitGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomUnitGroup" ADD CONSTRAINT "RoomUnitGroup_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "OrganisationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
