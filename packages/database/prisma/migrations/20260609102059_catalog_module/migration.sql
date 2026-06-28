/*
  Warnings:

  - You are about to drop the `Enterprise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EnterpriseMembership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantMembership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_challenges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_factors` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_identities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_sessions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organisationId,idempotencyKey]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('OUTPATIENT', 'INPATIENT');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('CONSULTATION', 'PROCEDURE', 'DIAGNOSTIC', 'MEDICATION', 'INVENTORY_ITEM', 'LAB_TEST', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PackageItemPricingMode" AS ENUM ('INCLUDED', 'INHERITED_PRICE', 'OVERRIDE_PRICE');

-- DropForeignKey
ALTER TABLE public."EnterpriseMembership" DROP CONSTRAINT "EnterpriseMembership_enterpriseId_fkey";

-- DropForeignKey
ALTER TABLE public."Tenant" DROP CONSTRAINT "Tenant_enterpriseId_fkey";

-- DropForeignKey
ALTER TABLE public."TenantMembership" DROP CONSTRAINT "TenantMembership_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "auth_challenges" DROP CONSTRAINT "auth_challenges_authAccountId_fkey";

-- DropForeignKey
ALTER TABLE "auth_factors" DROP CONSTRAINT "auth_factors_authAccountId_fkey";

-- DropForeignKey
ALTER TABLE "auth_identities" DROP CONSTRAINT "auth_identities_authAccountId_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_authAccountId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "appointmentKind" "AppointmentKind" NOT NULL DEFAULT 'OUTPATIENT',
ADD COLUMN     "caseId" TEXT,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "productItemId" TEXT;

-- AlterTable
ALTER TABLE "Speciality" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE public."Enterprise";

-- DropTable
DROP TABLE public."EnterpriseMembership";

-- DropTable
DROP TABLE public."Tenant";

-- DropTable
DROP TABLE public."TenantMembership";

-- DropTable
DROP TABLE "auth_accounts";

-- DropTable
DROP TABLE "auth_challenges";

-- DropTable
DROP TABLE "auth_factors";

-- DropTable
DROP TABLE "auth_identities";

-- DropTable
DROP TABLE "auth_sessions";

-- DropEnum
DROP TYPE "AuthChallengeStatus";

-- DropEnum
DROP TYPE "AuthChallengeType";

-- DropEnum
DROP TYPE "AuthFactorType";

-- DropEnum
DROP TYPE "AuthIdentityProvider";

-- DropEnum
DROP TYPE "AuthSessionClient";

-- DropEnum
DROP TYPE "AuthUserStatus";

-- CreateTable
CREATE TABLE "ProductItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "kind" "ProductKind" NOT NULL DEFAULT 'CONSULTATION',
    "specialityId" TEXT,
    "legacyServiceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productItemId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "defaultDiscountPercent" DOUBLE PRECISION,
    "maxDiscountPercent" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBookable" (
    "id" TEXT NOT NULL,
    "productItemId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "supportsOutpatient" BOOLEAN NOT NULL DEFAULT true,
    "supportsInpatient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBookable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPackage" (
    "id" TEXT NOT NULL,
    "productItemId" TEXT NOT NULL,
    "leadCount" INTEGER NOT NULL DEFAULT 1,
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "additionalDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "childProductItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricingMode" "PackageItemPricingMode" NOT NULL DEFAULT 'INCLUDED',
    "overridePrice" DOUBLE PRECISION,
    "discountPercent" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductItem_legacyServiceId_key" ON "ProductItem"("legacyServiceId");

-- CreateIndex
CREATE INDEX "ProductItem_organisationId_idx" ON "ProductItem"("organisationId");

-- CreateIndex
CREATE INDEX "ProductItem_organisationId_kind_isActive_idx" ON "ProductItem"("organisationId", "kind", "isActive");

-- CreateIndex
CREATE INDEX "ProductItem_organisationId_specialityId_idx" ON "ProductItem"("organisationId", "specialityId");

-- CreateIndex
CREATE INDEX "ProductPrice_productItemId_isDefault_idx" ON "ProductPrice"("productItemId", "isDefault");

-- CreateIndex
CREATE INDEX "ProductPrice_effectiveFrom_effectiveTo_idx" ON "ProductPrice"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBookable_productItemId_key" ON "ProductBookable"("productItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPackage_productItemId_key" ON "ProductPackage"("productItemId");

-- CreateIndex
CREATE INDEX "ProductPackageItem_packageId_sortOrder_idx" ON "ProductPackageItem"("packageId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductPackageItem_childProductItemId_idx" ON "ProductPackageItem"("childProductItemId");

-- CreateIndex
CREATE INDEX "Appointment_organisationId_productItemId_idx" ON "Appointment"("organisationId", "productItemId");

-- CreateIndex
CREATE INDEX "Appointment_caseId_idx" ON "Appointment"("caseId");

-- CreateIndex
CREATE INDEX "Appointment_encounterId_idx" ON "Appointment"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_organisationId_idempotencyKey_key" ON "Appointment"("organisationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Speciality_organisationId_isActive_idx" ON "Speciality"("organisationId", "isActive");

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBookable" ADD CONSTRAINT "ProductBookable_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackage" ADD CONSTRAINT "ProductPackage_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackageItem" ADD CONSTRAINT "ProductPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProductPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackageItem" ADD CONSTRAINT "ProductPackageItem_childProductItemId_fkey" FOREIGN KEY ("childProductItemId") REFERENCES "ProductItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
