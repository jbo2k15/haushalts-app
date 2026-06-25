-- Indexes on TaskCompletion for faster dashboard lookups
CREATE INDEX "TaskCompletion_taskId_idx" ON "TaskCompletion"("taskId");
CREATE INDEX "TaskCompletion_completedBy_idx" ON "TaskCompletion"("completedBy");

-- Indexes on TaskLog for trophy/stats queries
CREATE INDEX "TaskLog_completedBy_status_idx" ON "TaskLog"("completedBy", "status");
CREATE INDEX "TaskLog_loggedAt_idx" ON "TaskLog"("loggedAt");
CREATE INDEX "TaskLog_taskId_idx" ON "TaskLog"("taskId");
