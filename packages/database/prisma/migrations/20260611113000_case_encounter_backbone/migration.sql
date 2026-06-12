-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "parentId" TEXT,
    "status" TEXT NOT NULL,
    "appointmentKind" "AppointmentKind" NOT NULL DEFAULT 'OUTPATIENT',
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "parentId" TEXT,
    "status" TEXT NOT NULL,
    "encounterClass" TEXT NOT NULL,
    "appointmentKind" "AppointmentKind" NOT NULL DEFAULT 'OUTPATIENT',
    "title" TEXT,
    "reason" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Case_organisationId_status_idx" ON "Case"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Case_organisationId_appointmentKind_idx" ON "Case"("organisationId", "appointmentKind");

-- CreateIndex
CREATE INDEX "Case_companionId_idx" ON "Case"("companionId");

-- CreateIndex
CREATE INDEX "Case_parentId_idx" ON "Case"("parentId");

-- CreateIndex
CREATE INDEX "Encounter_caseId_idx" ON "Encounter"("caseId");

-- CreateIndex
CREATE INDEX "Encounter_organisationId_status_idx" ON "Encounter"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Encounter_organisationId_appointmentKind_idx" ON "Encounter"("organisationId", "appointmentKind");

-- CreateIndex
CREATE INDEX "Encounter_companionId_idx" ON "Encounter"("companionId");

-- CreateIndex
CREATE INDEX "Encounter_parentId_idx" ON "Encounter"("parentId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
