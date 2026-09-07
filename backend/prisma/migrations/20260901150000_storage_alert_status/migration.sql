-- CreateTable
CREATE TABLE "StorageAlertStatus" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedItemIds" TEXT NOT NULL DEFAULT '[]'
);
