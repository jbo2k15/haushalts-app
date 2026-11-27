-- Dienstplan-Kalender: Abgleich des Erledigt-Status mit der Quelle (z. B. der
-- Hühnerstall-App, siehe services/duty-done.js). Rein additiv.
--   externalUid      UID des Kalendertermins
--   externalSync     NULL = nie abgeglichen, "pending" = Meldung steht aus,
--                    "synced" = Quelle bestätigt, "rejected" = Quelle lehnt ab
--   externalPushedAt Zeitpunkt der letzten bestätigten Meldung
ALTER TABLE "Task" ADD COLUMN "externalUid" TEXT;
ALTER TABLE "Task" ADD COLUMN "externalSync" TEXT;
ALTER TABLE "Task" ADD COLUMN "externalPushedAt" DATETIME;
