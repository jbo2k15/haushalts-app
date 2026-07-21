-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "dailyTime" TEXT NOT NULL DEFAULT '21:00',
    "weeklyDay" INTEGER NOT NULL DEFAULT 6,
    "weeklyTime" TEXT NOT NULL DEFAULT '09:00',
    "monthlyDay" INTEGER NOT NULL DEFAULT 1,
    "monthlyTime" TEXT NOT NULL DEFAULT '09:00',
    "lastDailyNotifiedDate" TEXT,
    "lastWeeklyNotifiedDate" TEXT,
    "lastMonthlyNotifiedDate" TEXT,
    CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotificationSettings" ("dailyTime", "id", "lastDailyNotifiedDate", "lastWeeklyNotifiedDate", "userId", "weeklyDay", "weeklyTime") SELECT "dailyTime", "id", "lastDailyNotifiedDate", "lastWeeklyNotifiedDate", "userId", "weeklyDay", "weeklyTime" FROM "NotificationSettings";
DROP TABLE "NotificationSettings";
ALTER TABLE "new_NotificationSettings" RENAME TO "NotificationSettings";
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
