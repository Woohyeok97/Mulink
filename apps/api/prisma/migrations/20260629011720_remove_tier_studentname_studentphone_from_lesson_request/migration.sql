/*
  Warnings:

  - You are about to drop the column `studentName` on the `LessonRequest` table. All the data in the column will be lost.
  - You are about to drop the column `studentPhone` on the `LessonRequest` table. All the data in the column will be lost.
  - You are about to drop the column `tier` on the `LessonRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LessonRequest" DROP COLUMN "studentName",
DROP COLUMN "studentPhone",
DROP COLUMN "tier";
