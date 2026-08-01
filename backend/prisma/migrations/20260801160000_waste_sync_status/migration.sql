-- CreateTable
CREATE TABLE "WasteSyncStatus" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmatchedSummaries" TEXT NOT NULL DEFAULT '[]',
    "notifiedSummaries" TEXT NOT NULL DEFAULT '[]'
);
