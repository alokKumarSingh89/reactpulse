-- CreateEnum
CREATE TYPE "ScanEvidenceType" AS ENUM ('NAVIGATION', 'DOCUMENT_RESPONSE', 'NETWORK_REQUEST', 'BROWSER', 'CONSOLE');

-- DropForeignKey
ALTER TABLE "scans" DROP CONSTRAINT "scans_environmentId_fkey";

-- CreateTable
CREATE TABLE "scan_evidence" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" "ScanEvidenceType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_evidence_scanId_idx" ON "scan_evidence"("scanId");

-- CreateIndex
CREATE INDEX "scan_evidence_scanId_type_idx" ON "scan_evidence"("scanId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "scan_evidence_scanId_type_sequence_key" ON "scan_evidence"("scanId", "type", "sequence");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_evidence" ADD CONSTRAINT "scan_evidence_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
