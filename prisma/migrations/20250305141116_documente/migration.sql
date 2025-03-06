-- AlterTable
ALTER TABLE "Document" ADD COLUMN "storageManifest" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
