-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "completedBy" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forDate" TEXT NOT NULL,
    CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskCompletion_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskCompletion" ("completedAt", "completedBy", "forDate", "id", "taskId") SELECT "completedAt", "completedBy", "forDate", "id", "taskId" FROM "TaskCompletion";
DROP TABLE "TaskCompletion";
ALTER TABLE "new_TaskCompletion" RENAME TO "TaskCompletion";
CREATE INDEX "TaskCompletion_taskId_idx" ON "TaskCompletion"("taskId");
CREATE INDEX "TaskCompletion_completedBy_idx" ON "TaskCompletion"("completedBy");
CREATE UNIQUE INDEX "TaskCompletion_taskId_forDate_key" ON "TaskCompletion"("taskId", "forDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
