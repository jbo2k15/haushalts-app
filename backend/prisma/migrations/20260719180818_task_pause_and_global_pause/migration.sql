-- CreateTable
CREATE TABLE "TaskPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "pauseFrom" TEXT NOT NULL,
    "pauseTo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "TaskPause_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pauseFrom" TEXT NOT NULL,
    "pauseTo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
);

-- CreateIndex
CREATE INDEX "TaskPause_taskId_idx" ON "TaskPause"("taskId");
