-- AlterTable
ALTER TABLE "User" ADD COLUMN "verifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "verifyTokenExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_verifyTokenHash_key" ON "User"("verifyTokenHash");
