/*
  Warnings:

  - You are about to drop the column `humanifyMode` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "humanifyMode",
ADD COLUMN     "preferences" JSONB;
