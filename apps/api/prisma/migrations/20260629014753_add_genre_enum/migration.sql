/*
  Warnings:

  - Changed the type of `genre` on the `LessonRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('POP', 'BALLAD', 'ROCK', 'RNB', 'JAZZ', 'HIPHOP', 'TROT');

-- AlterTable
ALTER TABLE "LessonRequest" DROP COLUMN "genre",
ADD COLUMN     "genre" "Genre" NOT NULL;
