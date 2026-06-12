-- AlterTable
ALTER TABLE "Admission" RENAME COLUMN "bedUnitId" TO "unitId";

-- CreateTable
CREATE TABLE "RoomUnit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "size" TEXT,
    "speciesConstraints" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomUnitAssignment" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomUnitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomUnit_roomId_code_key" ON "RoomUnit"("roomId", "code");

-- CreateIndex
CREATE INDEX "RoomUnit_organisationId_idx" ON "RoomUnit"("organisationId");

-- CreateIndex
CREATE INDEX "RoomUnit_roomId_idx" ON "RoomUnit"("roomId");

-- CreateIndex
CREATE INDEX "RoomUnit_organisationId_isActive_idx" ON "RoomUnit"("organisationId", "isActive");

-- CreateIndex
CREATE INDEX "RoomUnitAssignment_encounterId_assignedAt_idx" ON "RoomUnitAssignment"("encounterId", "assignedAt");

-- CreateIndex
CREATE INDEX "RoomUnitAssignment_admissionId_assignedAt_idx" ON "RoomUnitAssignment"("admissionId", "assignedAt");

-- CreateIndex
CREATE INDEX "RoomUnitAssignment_unitId_assignedAt_idx" ON "RoomUnitAssignment"("unitId", "assignedAt");

-- CreateIndex
CREATE INDEX "RoomUnitAssignment_releasedAt_idx" ON "RoomUnitAssignment"("releasedAt");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RoomUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomUnit" ADD CONSTRAINT "RoomUnit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "OrganisationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomUnitAssignment" ADD CONSTRAINT "RoomUnitAssignment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomUnitAssignment" ADD CONSTRAINT "RoomUnitAssignment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("encounterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomUnitAssignment" ADD CONSTRAINT "RoomUnitAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RoomUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
