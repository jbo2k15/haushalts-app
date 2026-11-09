-- Fairness-Statistik (siehe domain/fairness.js). Rein additiv: neue Spalten
-- mit Default und eine neue Tabelle. Rueckbau siehe docs/fairness-entfernen.md.

-- Aufwand pro Aufgabe (1 = Leicht, 2 = Mittel, 3 = Aufwaendig)
ALTER TABLE "Task" ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 2;

-- Freigabe der Fairness-Karte pro Nutzer (Default aus)
ALTER TABLE "User" ADD COLUMN "showFairness" BOOLEAN NOT NULL DEFAULT false;

-- Punkte pro Erledigung. Alle bestehenden Eintraege sind Altbestand: sie
-- starten mit 2 (Mittel) und folgen spaeteren Aenderungen am Aufwand.
ALTER TABLE "TaskLog" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "TaskLog" ADD COLUMN "weightFromTask" BOOLEAN NOT NULL DEFAULT false;
UPDATE "TaskLog" SET "weightFromTask" = 1;

-- Urlaubszeiten
CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'toggle',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacationPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VacationPeriod_userId_idx" ON "VacationPeriod"("userId");
