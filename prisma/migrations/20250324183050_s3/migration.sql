/*
  Warnings:

  - You are about to drop the column `storageManifest` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `storagePath` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `uploaderId` on the `Document` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Certificate_subject_serialNumber_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "viewUrl" TEXT NOT NULL,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "ValidSigned" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "atualName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("ValidSigned", "atualName", "clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "updatedAt", "viewUrl") SELECT "ValidSigned", "atualName", "clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "updatedAt", "viewUrl" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_atualName_key" ON "Document"("atualName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
