-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "clientMsgId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_roomId_clientMsgId_key" ON "ChatMessage"("roomId", "clientMsgId");

