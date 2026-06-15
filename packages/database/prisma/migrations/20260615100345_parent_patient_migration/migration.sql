/*
  Warnings:

  - You are about to drop the column `companion` on the `AdverseEventReport` table. All the data in the column will be lost.
  - Added the required column `patient` to the `AdverseEventReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdverseEventReport" DROP COLUMN "companion",
ADD COLUMN     "patient" JSONB NOT NULL;
