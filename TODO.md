# Offene Aufgaben

## Sicherheit / Wartung

- [ ] **Deprecation-Warnung `inlineDynamicImports` von `vite-plugin-pwa`** (frontend) — seit Vite 8 setzt `vite-plugin-pwa@1.3.0` (aktuellste Version) beim internen Service-Worker-Build noch die alte Rollup-Option `output.inlineDynamicImports: true` statt Vites neuer `build.codeSplitting: false`. Hartcodiert im Plugin, nicht über unsere `vite.config.js` überschreibbar. Nur eine Warnung, keine Fehlfunktion. Beheben, sobald `vite-plugin-pwa` ein Vite-8-Kompatibilitäts-Release bringt — Changelog bei nächstem Scan prüfen.
- [ ] **`npm ci`-Deprecation-Warnungen beim Docker-Build** (2026-07-07 beim Deploy aufgefallen) — `source-map@0.8.0-beta.0` + `glob@11.1.0` kommen aus `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` (beide aktuellste Version, gehört zur selben "wartet auf Upstream"-Situation wie oben). `prebuild-install@7.1.3` kommt aus `better-sqlite3@12.11.1` (ebenfalls aktuellste Version). Reines Warnrauschen tief in der Kette, kein `npm audit`-Finding, nicht behebbar ohne Upstream-Release — bei künftigen Scans nur prüfen, ob eine neuere Version verfügbar ist.
- [ ] **Security-Review-Restbefunde (niedrig, aus Review am 2026-07-09)** — die kritischen/mittleren Härtungen (mustChangePassword serverseitig, FRONTEND_URL-Startup-Check, reset-password Token-Validierung, SMTP requireTLS) wurden bereits umgesetzt. Rest bewusst offen gelassen, geringe Priorität:
  - Access-Token in der SSE-URL (`/api/events?token=…`): bei EventSource technisch nötig (kein Header möglich), durch nginx `access_log off` + 15-min-Gültigkeit entschärft. Restrisiko Browser-History/Zwischen-Proxies. Alternative wäre ein kurzlebiges Einmal-Ticket statt des Access-Tokens — nur umsetzen, wenn der Aufwand gerechtfertigt scheint.
  - `loginMonitor` warnt nur bei exakt `=== THRESHOLD` (genau 20 Fehlversuche), nicht ab 20 — bei 21+ keine weitere Warnung. Falls als Dauer-Alarm gedacht: `>=` mit Cooldown, sonst Kosmetik.
  - `POST /users/push-subscription` löscht jede Subscription mit dem gegebenen `endpoint` und legt sie für den aktuellen User neu an — ein authentifizierter Nutzer, der den (geheimen, geräte-spezifischen) Endpoint eines anderen kennt, könnte ihn übernehmen. Praktisch kaum ausnutzbar; sauberer wäre, ein Übernehmen nur zuzulassen, wenn der Endpoint noch keinem anderen User gehört.

## Feature-Ideen (für später, noch nicht angefangen)

- [ ] **Fairness-Transparenz in der Ruhmeshalle** (erweiterte Variante mit Gewichtung) — Recherche zu Erwachsenen-/Paar-Chore-Apps (evenus.app, FairShare, Chore Chores, FairChore) zeigt: die Ruhmeshalle optimiert aktuell auf Wettbewerb (Pokale, Sieger), nicht auf Fairness (wer trägt wie viel bei). Idee: zusätzliche Karte auf der Ruhmeshalle-Seite, unterhalb der bestehenden Legende:
  - Gestapelter Balken zeigt den prozentualen Anteil erledigter Aufgaben pro Person über ein rollierendes Fenster (z. B. 30 Tage)
  - Trend-Satz darunter, der einordnet, ob sich die Verteilung verbessert/verschlechtert hat ggü. dem Vormonat
  - Kleiner Wochenverlauf (gestapelte Mini-Balken pro Kalenderwoche), damit einzelne Ausreißerwochen (Urlaub, Krankheit) nicht als dauerhafte Schieflage fehlinterpretiert werden
  - Erweiterte Variante (statt reiner Zählung): jede Aufgabe bekommt ein optionales Schwierigkeits-/Aufwandsgewicht (z. B. 1 = Leicht, 2 = Mittel, 3 = Aufwändig), damit "Müll rausbringen" nicht gleich zählt wie "Bad putzen" — erfordert neues `difficulty`-Feld am Task-Modell (Migration, Default "Mittel" sowohl für neue als auch bestehende Aufgaben) plus Verwaltungs-UI zum Setzen des Werts (Auswahl Leicht/Mittel/Aufwändig im Bearbeiten-Formular, JSON-Export/Import nimmt das Feld automatisch mit)
  - **Berechnungsformel:** pro Person Summe aus (Anzahl Erledigungen × Schwierigkeitsgewicht der jeweiligen Aufgabe zum Erledigungszeitpunkt) über das Zeitfenster; die beiden (bzw. mehreren) Personensummen werden zueinander ins Verhältnis gesetzt (Anteil = eigene Summe / Summe aller). Jede einzelne Erledigung zählt separat (nicht nur "an dem Tag mindestens einmal gemacht"), nutzt also das bestehende Mehrfach-Erledigen-Feature korrekt aus.
  - **Trend-Vergleich zum Vormonat und Wochenverlauf** müssen beide nach derselben gewichteten Formel berechnet werden (gewichteter Anteil des vorherigen 30-Tage-Fensters bzw. je Kalenderwoche), nicht nach reiner Erledigungs-Anzahl — sonst sind aktueller und vorheriger Wert nicht vergleichbar. Der Trend-Satz sollte das auch explizit benennen ("gewichteter Anteil war X/Y"), damit nicht der Eindruck entsteht, es handle sich um eine reine Erledigungs-Anzahl.
  - **Schwierigkeitsgewicht wird beim Erledigen eingefroren** (Snapshot im Completion-Datensatz), nicht live aus dem aktuellen Task-Wert berechnet — eine nachträgliche Korrektur des Gewichts verändert also nicht rückwirkend die Statistik vergangener Zeiträume. Bewusste Entscheidung des Nutzers (2026-07-09), trotz des Nachteils, dass sich ein falsch gesetztes Anfangsgewicht später nicht rückwirkend korrigieren lässt.
  - **Zurückgenommene Erledigungen** (bestehendes Undo-Feature) müssen aus der Statistik verschwinden — ergibt sich automatisch, wenn die Fairness-Zahlen live aus den echten Completion-Datensätzen aggregiert werden statt separat mitgezählt.
  - **Sichtbarkeit:** globaler Ein/Aus-Schalter in der Verwaltung ("Fairness-Statistik anzeigen"), da Fairness-Zahlen ohne Kontext auch Konflikte auslösen können statt sie zu lösen. Bei 2 aktuellen Haushaltsmitgliedern (Design-Grenze: bis ca. 4–6 Personen sinnvoll, danach bräuchte der gestapelte Balken eine Listen-/Tabellen-Alternative).
  - **Farben neutral wählen** (z. B. Lila/Teal statt Grün/Koralle) — eine Grün/Rot-ähnliche Farbgebung würde unbewusst als Gut/Schlecht-Bewertung gelesen, obwohl nur eine neutrale Verteilung gezeigt werden soll.
  - **Urlaubsmodus verzerrt aktuell nicht** — Nutzer sind gemeinsam im Urlaub, kein Sonderfall für die Berechnung nötig.
  - **Aufgaben-Erledigen-UI bleibt bewusst unverändert** — der Schwierigkeitsgrad wird beim Abhaken nicht angezeigt, um "strategisches" Aufgaben-Picken (leichte Aufgaben bevorzugen) zu vermeiden.
  - Mockups wurden in einer Konversation mit Claude Code erstellt (2026-07-09, zuletzt aktualisiert): (1) Fairness-Karte mit gestapeltem Balken (Lila/Teal statt Grün/Koralle), Trend-Satz explizit als "gewichteter Anteil" beschriftet (war zunächst mehrdeutig als reine Anzahl lesbar, jetzt korrigiert), zwei Stat-Kärtchen "erledigt + Ø Schwierigkeit" pro Person, 4-Wochen-Verlauf als Mini-Balkendiagramm (zeigt ebenfalls den gewichteten Wochen-Anteil, nicht die Rohzahl); (2) Verwaltungs-Bereich mit Ein/Aus-Schalter "Fairness-Statistik anzeigen" plus Einstieg zum Pflegen der Schwierigkeitsgrade; (3) Aufgabenverwaltung — Aufgabenliste mit Schwierigkeits-Badge und Bearbeiten-Formular mit neuem Leicht/Mittel/Aufwändig-Feld (Default Mittel). Alle visuell im bestehenden App-Stil (abgerundete Karten, gleiche Farbpalette).
  - Noch offen: Rundungsverhalten der Prozentanzeige, Darstellung bei 0 Erledigungen einer Person, konkrete Umsetzung der Listen-/Tabellen-Alternative ab mehr als ~4 Haushaltsmitgliedern

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
