/*
  Warnings:

  - Added the required column `csr` to the `Certificate` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "issuer" TEXT NOT NULL,
    "certificatePem" TEXT NOT NULL,
    "clientId" TEXT,
    "pathCertificate" TEXT,
    "pfxPassword" TEXT,
    "csr" TEXT NOT NULL,
    "isCA" BOOLEAN NOT NULL DEFAULT false,
    "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("certificatePem", "clientId", "createdAt", "id", "isCA", "isDownloaded", "isValid", "issuedAt", "issuer", "pathCertificate", "pfxPassword", "privateKey", "publicKey", "serialNumber", "subject", "updatedAt", "validUntil") SELECT "certificatePem", "clientId", "createdAt", "id", "isCA", "isDownloaded", "isValid", "issuedAt", "issuer", "pathCertificate", "pfxPassword", "privateKey", "publicKey", "serialNumber", "subject", "updatedAt", "validUntil" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_subject_serialNumber_key" ON "Certificate"("subject", "serialNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
