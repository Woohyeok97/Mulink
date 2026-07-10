-- DropIndex
DROP INDEX "LessonRequest_studentId_idx";

-- CreateTable
CREATE TABLE "LessonProposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "coachId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonProposal_requestId_idx" ON "LessonProposal"("requestId");

-- CreateIndex
CREATE INDEX "LessonProposal_coachId_idx" ON "LessonProposal"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProposal_requestId_coachId_key" ON "LessonProposal"("requestId", "coachId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonRequest_studentId_key" ON "LessonRequest"("studentId");

-- AddForeignKey
ALTER TABLE "LessonProposal" ADD CONSTRAINT "LessonProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LessonRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProposal" ADD CONSTRAINT "LessonProposal_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

