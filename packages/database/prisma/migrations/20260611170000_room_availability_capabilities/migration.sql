-- CreateEnum
CREATE TYPE "RoomAvailabilityMode" AS ENUM ('DEFAULT', 'ALWAYS_ON', 'CUSTOM');

-- AlterTable
ALTER TABLE "OrganisationRoom"
ADD COLUMN "code" TEXT,
ADD COLUMN "availableNow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "availabilityMode" "RoomAvailabilityMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN "availabilityDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "availabilityStartTime" TEXT,
ADD COLUMN "availabilityEndTime" TEXT,
ADD COLUMN "speciesConstraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "OrganisationRoom_organisationId_availableNow_idx" ON "OrganisationRoom"("organisationId", "availableNow");
