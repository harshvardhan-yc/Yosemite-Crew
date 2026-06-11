-- CreateTable
CREATE TABLE "Admission" (
    "encounterId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "bedUnitId" TEXT,
    "expectedStayDays" INTEGER,
    "admittedAt" TIMESTAMP(3) NOT NULL,
    "dischargedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("encounterId")
);

-- CreateIndex
CREATE INDEX "Admission_organisationId_admittedAt_idx" ON "Admission"("organisationId", "admittedAt");

-- CreateIndex
CREATE INDEX "Admission_organisationId_dischargedAt_idx" ON "Admission"("organisationId", "dischargedAt");

-- CreateIndex
CREATE INDEX "Admission_companionId_idx" ON "Admission"("companionId");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
