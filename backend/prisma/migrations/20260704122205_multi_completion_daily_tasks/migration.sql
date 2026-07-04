-- DropIndex
DROP INDEX "TaskCompletion_taskId_forDate_key";

-- DropIndex
DROP INDEX "TaskCompletion_taskId_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "taskTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "completedBy" TEXT,
    "userName" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forDate" TEXT NOT NULL,
    "completionId" TEXT,
    CONSTRAINT "TaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskLog_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskLog_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "TaskCompletion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskLog" ("completedBy", "forDate", "id", "loggedAt", "status", "taskId", "taskTitle", "userName") SELECT "completedBy", "forDate", "id", "loggedAt", "status", "taskId", "taskTitle", "userName" FROM "TaskLog";
DROP TABLE "TaskLog";
ALTER TABLE "new_TaskLog" RENAME TO "TaskLog";
CREATE INDEX "TaskLog_completedBy_status_forDate_idx" ON "TaskLog"("completedBy", "status", "forDate");
CREATE INDEX "TaskLog_loggedAt_idx" ON "TaskLog"("loggedAt");
CREATE INDEX "TaskLog_taskId_forDate_status_idx" ON "TaskLog"("taskId", "forDate", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskCompletion_taskId_forDate_idx" ON "TaskCompletion"("taskId", "forDate");
