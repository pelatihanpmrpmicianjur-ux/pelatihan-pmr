/*
  Warnings:

  - A unique constraint covering the columns `[name,capacity]` on the table `TentType` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `capacityDisplay` to the `TentType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `TentType` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."TentType_capacity_key";

-- AlterTable
ALTER TABLE "public"."TentType" ADD COLUMN     "capacityDisplay" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TentType_name_capacity_key" ON "public"."TentType"("name", "capacity");
