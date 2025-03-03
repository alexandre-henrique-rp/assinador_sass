/*
  Warnings:

  - You are about to drop the column `localPath` on the `Document` table. All the data in the column will be lost.

*/
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
    "storagePath" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "viewUrl" TEXT NOT NULL,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "atualName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("atualName", "clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "storagePath", "updatedAt", "uploaderId", "viewUrl") SELECT "atualName", "clientId", "createdAt", "documentType", "downloadUrl", "extension", "hash", "id", "isSigned", "originalName", "size", "storagePath", "updatedAt", "uploaderId", "viewUrl" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_clientId_hash_key" ON "Document"("clientId", "hash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
