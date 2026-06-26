-- Replace individual indexes with compound indexes for query patterns
DROP INDEX IF EXISTS "TaskLog_completedBy_status_idx";
DROP INDEX IF EXISTS "TaskLog_taskId_idx";

CREATE INDEX "TaskLog_completedBy_status_forDate_idx" ON "TaskLog"("completedBy", "status", "forDate");
CREATE INDEX "TaskLog_taskId_forDate_status_idx" ON "TaskLog"("taskId", "forDate", "status");
