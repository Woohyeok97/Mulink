/*
  Warnings:

  - Changed the type of `region` on the `LessonRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Region" ADD VALUE 'BUSAN';
ALTER TYPE "Region" ADD VALUE 'DAEGU';
ALTER TYPE "Region" ADD VALUE 'ULSAN';
ALTER TYPE "Region" ADD VALUE 'GWANGJU';
ALTER TYPE "Region" ADD VALUE 'DAEJEON';

-- AlterTable
ALTER TABLE "LessonRequest" DROP COLUMN "region",
ADD COLUMN     "region" "Region" NOT NULL;
