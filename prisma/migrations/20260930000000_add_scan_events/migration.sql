-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "qrLinkId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanEvent_qrLinkId_scannedAt_idx" ON "ScanEvent"("qrLinkId", "scannedAt");

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_qrLinkId_fkey" FOREIGN KEY ("qrLinkId") REFERENCES "QrLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
