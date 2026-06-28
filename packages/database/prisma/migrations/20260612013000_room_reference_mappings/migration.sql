-- Remove denormalized string arrays.
ALTER TABLE "OrganisationRoom"
DROP COLUMN IF EXISTS "assignedSpecialiteis",
DROP COLUMN IF EXISTS "assignedStaffs";

-- Store room assignments as proper mapping rows.
CREATE TABLE "OrganisationRoomSpeciality" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "specialityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganisationRoomSpeciality_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganisationRoomStaff" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganisationRoomStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganisationRoomSpeciality_roomId_specialityId_key"
  ON "OrganisationRoomSpeciality"("roomId", "specialityId");
CREATE INDEX "OrganisationRoomSpeciality_organisationId_idx"
  ON "OrganisationRoomSpeciality"("organisationId");
CREATE INDEX "OrganisationRoomSpeciality_roomId_idx"
  ON "OrganisationRoomSpeciality"("roomId");
CREATE INDEX "OrganisationRoomSpeciality_specialityId_idx"
  ON "OrganisationRoomSpeciality"("specialityId");

CREATE UNIQUE INDEX "OrganisationRoomStaff_roomId_staffUserId_key"
  ON "OrganisationRoomStaff"("roomId", "staffUserId");
CREATE INDEX "OrganisationRoomStaff_organisationId_idx"
  ON "OrganisationRoomStaff"("organisationId");
CREATE INDEX "OrganisationRoomStaff_roomId_idx"
  ON "OrganisationRoomStaff"("roomId");
CREATE INDEX "OrganisationRoomStaff_staffUserId_idx"
  ON "OrganisationRoomStaff"("staffUserId");

ALTER TABLE "OrganisationRoomSpeciality"
ADD CONSTRAINT "OrganisationRoomSpeciality_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "OrganisationRoom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganisationRoomSpeciality"
ADD CONSTRAINT "OrganisationRoomSpeciality_specialityId_fkey"
FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganisationRoomStaff"
ADD CONSTRAINT "OrganisationRoomStaff_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "OrganisationRoom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganisationRoomStaff"
ADD CONSTRAINT "OrganisationRoomStaff_staffUserId_fkey"
FOREIGN KEY ("staffUserId") REFERENCES "User"("userId")
ON DELETE CASCADE ON UPDATE CASCADE;
