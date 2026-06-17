-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "VocalTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "kakaoId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "voiceAudioUrl" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "tier" "VocalTier",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");

-- CreateIndex
CREATE INDEX "LessonRequest_studentId_idx" ON "LessonRequest"("studentId");

-- AddForeignKey
ALTER TABLE "LessonRequest" ADD CONSTRAINT "LessonRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
