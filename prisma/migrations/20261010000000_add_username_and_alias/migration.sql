-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "QrLink" ADD COLUMN "alias" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "QrLink_userId_alias_key" ON "QrLink"("userId", "alias");
