-- CreateTable
CREATE TABLE "WeatherStatus" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rainMM" REAL NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "vacationMode" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnWeatherSkip" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenVersion" TEXT,
    "hasSeenSwipeTip" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME,
    "dayTrophies" INTEGER NOT NULL DEFAULT 0,
    "weekTrophies" INTEGER NOT NULL DEFAULT 0,
    "monthTrophies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("approved", "createdAt", "dayTrophies", "email", "hasSeenSwipeTip", "id", "lastActiveAt", "lastSeenVersion", "monthTrophies", "mustChangePassword", "name", "passwordHash", "role", "vacationMode", "weekTrophies") SELECT "approved", "createdAt", "dayTrophies", "email", "hasSeenSwipeTip", "id", "lastActiveAt", "lastSeenVersion", "monthTrophies", "mustChangePassword", "name", "passwordHash", "role", "vacationMode", "weekTrophies" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
