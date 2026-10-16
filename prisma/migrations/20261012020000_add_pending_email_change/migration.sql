-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "pendingEmailTokenHash" TEXT,
ADD COLUMN "pendingEmailExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmailTokenHash_key" ON "User"("pendingEmailTokenHash");
