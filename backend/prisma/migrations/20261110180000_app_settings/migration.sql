-- Haushaltsweite App-Einstellungen (Singleton, fixe id "singleton").
-- registrationEnabled: Selbst-Registrierung erlaubt? Standard AUS; wird von
-- Admins in den Einstellungen (Nutzerverwaltung) umgeschaltet. Rein additiv.
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT false
);
