-- Fairness-Statistik: Zaehlweise fuer Rangliste und Statistik (Anzahl oder
-- nach Aufwand gewichtet). Rein additiv; Standard bleibt "count".
CREATE TABLE "FairnessSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "countMode" TEXT NOT NULL DEFAULT 'count'
);
