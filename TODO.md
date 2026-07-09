# Offene Aufgaben

## Sicherheit / Wartung

- [ ] **Deprecation-Warnung `inlineDynamicImports` von `vite-plugin-pwa`** (frontend) — seit Vite 8 setzt `vite-plugin-pwa@1.3.0` (aktuellste Version) beim internen Service-Worker-Build noch die alte Rollup-Option `output.inlineDynamicImports: true` statt Vites neuer `build.codeSplitting: false`. Hartcodiert im Plugin, nicht über unsere `vite.config.js` überschreibbar. Nur eine Warnung, keine Fehlfunktion. Beheben, sobald `vite-plugin-pwa` ein Vite-8-Kompatibilitäts-Release bringt — Changelog bei nächstem Scan prüfen.
- [ ] **`npm ci`-Deprecation-Warnungen beim Docker-Build** (2026-07-07 beim Deploy aufgefallen) — `source-map@0.8.0-beta.0` + `glob@11.1.0` kommen aus `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` (beide aktuellste Version, gehört zur selben "wartet auf Upstream"-Situation wie oben). `prebuild-install@7.1.3` kommt aus `better-sqlite3@12.11.1` (ebenfalls aktuellste Version). Reines Warnrauschen tief in der Kette, kein `npm audit`-Finding, nicht behebbar ohne Upstream-Release — bei künftigen Scans nur prüfen, ob eine neuere Version verfügbar ist.

## Feature-Ideen (für später, noch nicht angefangen)

- [ ] **Fairness-Transparenz in der Ruhmeshalle** (erweiterte Variante mit Gewichtung) — Recherche zu Erwachsenen-/Paar-Chore-Apps (evenus.app, FairShare, Chore Chores, FairChore) zeigt: die Ruhmeshalle optimiert aktuell auf Wettbewerb (Pokale, Sieger), nicht auf Fairness (wer trägt wie viel bei). Idee: zusätzliche Karte auf der Ruhmeshalle-Seite, unterhalb der bestehenden Legende:
  - Gestapelter Balken zeigt den prozentualen Anteil erledigter Aufgaben pro Person über ein rollierendes Fenster (z. B. 30 Tage)
  - Trend-Satz darunter, der einordnet, ob sich die Verteilung verbessert/verschlechtert hat ggü. dem Vormonat
  - Kleiner Wochenverlauf (gestapelte Mini-Balken pro Kalenderwoche), damit einzelne Ausreißerwochen (Urlaub, Krankheit) nicht als dauerhafte Schieflage fehlinterpretiert werden
  - Erweiterte Variante (statt reiner Zählung): jede Aufgabe bekommt ein optionales Schwierigkeits-/Aufwandsgewicht (z. B. 1–3), damit "Müll rausbringen" nicht gleich zählt wie "Bad putzen" — erfordert neues `difficulty`-Feld am Task-Modell (Migration) plus Verwaltungs-UI zum Setzen des Werts
  - Mockup wurde in einer Konversation mit Claude Code erstellt (2026-07-09) — Balken in Grün/Coral je Person, zwei Stat-Kärtchen "erledigt + Ø Schwierigkeit" pro Person, darunter 4-Wochen-Verlauf als Mini-Balkendiagramm; visuell im bestehenden App-Stil (abgerundete Karten, gleiche Farbpalette)
  - Offene Fragen vor Umsetzung (siehe laufende Diskussion): Umgang mit Urlaubsmodus/Abwesenheit in der Berechnung, Sichtbarkeit/Opt-in (Fairness-Zahlen können auch Konflikte auslösen statt sie zu lösen), rollierendes Zeitfenster (7 vs. 30 Tage), Verhalten bei mehr als 2 Haushaltsmitgliedern, wer das Schwierigkeitsgewicht pro Aufgabe festlegen darf

- [ ] **Mehrere Haushalte** — Große Änderung, Anforderungen noch nicht geschärft. Eckpunkte aus erstem Gespräch:
  - Getrennte Aufgaben und Statistiken pro Haushalt
  - Ein Nutzer kann Mitglied in mehreren Haushalten sein
  - Nutzer kann zwischen seinen Haushalten wechseln
  - Beitritt zu einem Haushalt nur per Einladung (kein offener Self-Signup pro Haushalt)
  - Vor Umsetzung: Anforderungen im Detail klären (u.a. Rollen/Rechte pro Haushalt, Einladungs-Mechanismus, Datenmodell-Migration für bestehende Nutzer/Aufgaben, Auswirkung auf Admin-Verwaltung, Ruhmeshalle und Push-Benachrichtigungen)

---

## Erledigt (Archiv)

- ✅ Reload/Pull-to-Refresh in der installierten PWA landete manchmal auf der falschen Seite — zwei Ursachen behoben: (1) `PageCarousel.jsx` initialisierte Embla immer bei Slide 0 (Home) und scrollte erst danach zur tatsächlichen Route, das erzeugte einen sichtbaren Flash der Aufgabenübersicht vor jedem Wechsel zur Ruhmeshalle — jetzt per `startIndex` (einmalig in einem Ref eingefroren) korrekt initialisiert; (2) der "Ruhmeshalle"-Button und alle HeaderMenu-Einträge navigierten per Push statt Replace, anders als die Wisch-Navigation, was zusätzliche History-Einträge erzeugte — jetzt durchgängig `replace: true`. Auf dem Gerät des Nutzers verifiziert (2026-07-08)
- ✅ Pull-to-Refresh in der installierten PWA landete nach Zurückwischen manchmal wieder auf der Ruhmeshalle — Ursache: der Embla-`onSelect`-Handler in `PageCarousel.jsx` übersprang das URL-Update, wenn `selectedScrollSnap()` (durch `loop: true` und dessen interne Klon-Slides) einen Index außerhalb von `PAGES` lieferte; Adressleiste blieb dann auf dem alten Pfad stehen, obwohl visuell schon Home zu sehen war. Fix: Index wird jetzt per Modulo auf den gültigen Bereich normalisiert, URL-Update läuft nicht mehr über eine stillschweigend übersprungene Bedingung (2026-07-08)
- ✅ Navigation vereinheitlicht: "← Zurück"-Buttons auf Admin/Settings/Ruhmeshalle durch gemeinsames Menü ersetzt (nur noch Wischen + Menü als Navigationswege) (2026-07-07)
- ✅ Release-Notes-Modal richtet sich jetzt nach der tatsächlich laufenden Frontend-Version statt nach der Backend-Version (2026-07-07)
- ✅ Swipe-Navigation zwischen Home und Ruhmeshalle (v1.8.0, 2026-07-07)
- ✅ VAPID-Schlüsselpaar rotiert nach GitGuardian-Meldung (2026-07-07) — Details: Commit "Security: geleakten VAPID-Schluessel aus Test-Configs entfernen"
- ✅ Server-Resync nach Git-History-Rewrite (2026-07-07)
- ✅ Push-Subscriptions erkennen jetzt Ungültigkeit nach VAPID-Rotation (2026-07-07)
- ✅ Major-Updates `vite` 7→8, `@vitejs/plugin-react` 4→6, `react-router` 7→8, `tailwindcss` 3→4 (2026-07-06)
- ✅ Backend-Vulnerability in Prisma/@hono/node-server-Kette gefixt ohne Downgrade (2026-07-06)

Details und Entscheidungshistorie zu Scans: siehe lokale Notizen zum wöchentlichen Security-/Dependency-Scan (nicht Teil dieses Repos). Für alles andere: Git-Log.
