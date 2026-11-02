-- Vorrat: Mengen und Mindestmengen als Kommazahlen (z. B. 1,5 kg Mehl)
-- statt Ganzzahlen. SQLite kann Spaltentypen nicht aendern, daher wie von
-- Prisma generiert per Tabellen-Neuanlage; bestehende Werte bleiben erhalten.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StorageCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultMinQuantity" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "StorageCategory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StorageCategory" ("defaultMinQuantity", "id", "locationId", "name", "sortOrder") SELECT "defaultMinQuantity", "id", "locationId", "name", "sortOrder" FROM "StorageCategory";
DROP TABLE "StorageCategory";
ALTER TABLE "new_StorageCategory" RENAME TO "StorageCategory";
CREATE UNIQUE INDEX "StorageCategory_locationId_name_key" ON "StorageCategory"("locationId", "name");
CREATE TABLE "new_StorageItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT,
    "minQuantity" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StorageItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StorageItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StorageCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StorageItem" ("categoryId", "id", "locationId", "minQuantity", "name", "quantity", "sortOrder", "unit") SELECT "categoryId", "id", "locationId", "minQuantity", "name", "quantity", "sortOrder", "unit" FROM "StorageItem";
DROP TABLE "StorageItem";
ALTER TABLE "new_StorageItem" RENAME TO "StorageItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
