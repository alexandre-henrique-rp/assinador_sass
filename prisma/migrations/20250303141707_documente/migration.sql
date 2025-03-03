/*
  Warnings:

  - You are about to drop the column `signerCpf` on the `Signature` table. All the data in the column will be lost.
  - Made the column `clientId` on table `Certificate` required. This step will fail if there are existing NULL values in that column.

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
    "clientId" TEXT NOT NULL,
    "isCA" BOOLEAN NOT NULL DEFAULT false,
    "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("certificatePem", "clientId", "createdAt", "id", "isCA", "isDownloaded", "isValid", "issuedAt", "issuer", "privateKey", "publicKey", "serialNumber", "subject", "updatedAt", "validUntil") SELECT "certificatePem", "clientId", "createdAt", "id", "isCA", "isDownloaded", "isValid", "issuedAt", "issuer", "privateKey", "publicKey", "serialNumber", "subject", "updatedAt", "validUntil" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_subject_serialNumber_key" ON "Certificate"("subject", "serialNumber");
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "viewUrl" TEXT NOT NULL,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "storagePath", "updatedAt", "viewUrl") SELECT "clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "storagePath", "updatedAt", "viewUrl" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_clientId_hash_key" ON "Document"("clientId", "hash");
CREATE TABLE "new_Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signerId" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'Avançada',
    "certificateId" TEXT,
    "documentId" TEXT NOT NULL,
    "signatureData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Signature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Signature" ("certificateId", "createdAt", "documentId", "id", "signatureData", "signedAt", "signerId", "type", "updatedAt") SELECT "certificateId", "createdAt", "documentId", "id", "signatureData", "signedAt", "signerId", "type", "updatedAt" FROM "Signature";
DROP TABLE "Signature";
ALTER TABLE "new_Signature" RENAME TO "Signature";
CREATE UNIQUE INDEX "Signature_signerId_documentId_key" ON "Signature"("signerId", "documentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
