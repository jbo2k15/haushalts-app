# Haushalts-App

Mobile-first PWA für gemeinsames Haushaltsaufgaben-Management.

## Funktionen

- **Aufgaben** — Tägliche, wöchentliche, monatliche und einmalige Aufgaben (mit Fälligkeitsdatum); Drag & Drop zum Sortieren; tägliche Aufgaben können für den Tag übersprungen werden; an bestimmte Wochentage gebundene Aufgaben bleiben nach einem verpassten Tag noch als überfällig sichtbar
- **Mehrfach erledigbare Aufgaben** — Tägliche und wöchentliche Aufgaben können bei Bedarf per Verwaltung so konfiguriert werden, dass sie mehrmals pro Tag/Woche erledigt werden können, mit Zähler und der Möglichkeit, die letzte Erledigung zurückzunehmen
- **Aufgabenlog** — Protokoll aller erledigten, abgelaufenen, übersprungenen und gelöschten Aufgaben (bis 100 Einträge)
- **Statistiken** — Erledigte Aufgaben pro Nutzer für heute, diese Woche, letzte Woche, diesen und letzten Monat
- **Ruhmeshalle** — Gesamtranking mit Trophäen für Tages-, Wochen- und Monatssieger; per Wisch-Geste (links/rechts, Touch oder Maus) direkt von der Startseite erreichbar
- **Navigation** — Zwei konstante Wege: Wischen zwischen Startseite und Ruhmeshalle sowie ein einheitliches Menü (oben rechts) mit direktem Zugriff auf Aufgabenübersicht, Einstellungen, Ruhmeshalle und (für Admins) Verwaltung
- **Push-Benachrichtigungen** — Tägliche und wöchentliche Erinnerungen an offene Aufgaben (konfigurierbare Uhrzeit)
- **Abfallkalender** — Einmalige Aufgaben aus iCal-Feed für jeden konkreten Abholtermin; laufen am Folgetag automatisch ab und erscheinen im Log als „verfallen"
- **Wetterabhängige Aufgaben** — Tägliche Aufgaben (z.B. „Blumen gießen") können als wetterabhängig markiert werden und entfallen automatisch, sobald seit Mitternacht eine konfigurierbare Regenmenge überschritten wurde (alle 15 Minuten geprüft, Open-Meteo, kein API-Key nötig); Verwaltung zeigt den aktuellen Wetter-Status, Benachrichtigung dazu ist pro Nutzer ein-/ausschaltbar
- **Pausenzeitraum für Aufgaben** — Tägliche, wöchentliche und monatliche Aufgaben können für einen Zeitraum pausiert werden, einzeln pro Aufgabe oder haushaltsweit über eine „Alle Aufgaben pausieren"-Karte in der Verwaltung; pausierte Aufgaben verschwinden für den Zeitraum aus der Übersicht (Sammelzeile zeigt die Anzahl), einmalige Aufgaben und Abfallkalender-Termine sind davon ausgenommen
- **Urlaubsmodus** — Pausiert Benachrichtigungen für einzelne Nutzer
- **Export / Import** — Aufgaben als JSON exportieren und importieren (max. 200 Aufgaben)
- **Nutzerverwaltung** — Registrierung mit Admin-Freischaltung, Rollenverwaltung, Sperren/Entsperren, Löschen
- **Passwort-Reset** — Per E-Mail-Link; invalidiert automatisch alle aktiven Sessions
- **PWA** — Installierbar auf Android und iOS; funktioniert nach Erstladen auch offline (statische Assets)
- **Echtzeit-Sync** — Änderungen anderer Nutzer erscheinen sofort per Server-Sent Events, mit Fallback-Polling
- **Sicherheit** — Rate-Limiting (pro Endpunkt), Honeypot gegen Bot-Registrierungen, timing-safe Login/Passwort-Reset, serverseitige Eingabevalidierung, Warnprotokoll bei gehäuften Login-Fehlversuchen

---

## Voraussetzungen

- Docker + Docker Compose
- Node.js 22+ und npm (für Backend-Tests und Playwright-E2E-Tests, die `deploy.sh` vor jedem Build ausführt)
- Git
- Cloudflare-Account (für externen Zugriff mit TLS)
- Gmail-Account mit App-Passwort (für E-Mail-Versand)
- Mindestens **20 GB Festplatte** und **1 GB RAM** auf dem Server — native Module (`better-sqlite3`) müssen kompiliert werden, und Docker-Builds + Test-Läufe brauchen spürbar mehr Headroom als der reine Laufzeitbetrieb

---

## Einrichtung

### 1. Repository klonen

```bash
git clone https://github.com/jbo2k15/haushalts-app.git
cd haushalts-app
```

### 2. VAPID-Keys generieren

```bash
cd backend
npm install
npx web-push generate-vapid-keys
cd ..
```

Die ausgegebenen Keys in die `.env`-Datei eintragen.

### 3. `.env`-Datei erstellen

```bash
cp .env.example .env
```

Alle Werte in `.env` ausfüllen:

| Variable | Beschreibung |
|---|---|
| `JWT_SECRET` | Langer zufälliger String — `openssl rand -hex 32` |
| `ADMIN_EMAIL` | E-Mail-Adresse des ersten Admin-Accounts |
| `ADMIN_PASSWORD` | Initiales Admin-Passwort (min. 10 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen) |
| `FRONTEND_URL` | Deine Domain (z.B. `https://haushalt.meinedomain.de`) |
| `SMTP_HOST` | SMTP-Server (z.B. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP-Port (z.B. `587`) |
| `SMTP_USER` | Absender-E-Mail-Adresse |
| `SMTP_PASS` | Gmail App-Passwort (siehe unten) |
| `VAPID_PUBLIC_KEY` | Aus Schritt 2 |
| `VAPID_PRIVATE_KEY` | Aus Schritt 2 |
| `VAPID_EMAIL` | `mailto:deine@email.de` |
| `WASTE_ICAL_URL` | iCal-URL des Abfallkalenders (optional, muss mit `https://` beginnen) |
| `WEATHER_LAT` / `WEATHER_LON` | Koordinaten des Haushalts für die Regenmessung (optional — ohne diese Werte bleibt die Wetterabhängigkeit inaktiv) |
| `WEATHER_RAIN_THRESHOLD_MM` | Regenmenge in mm seit Mitternacht, ab der wetterabhängige Aufgaben automatisch erledigt werden (optional, Default `5`) |

### 4. App starten

```bash
docker compose up --build -d
```

Der erste Admin-Account wird automatisch mit den Werten aus `ADMIN_EMAIL` und `ADMIN_PASSWORD` angelegt. Das Passwort muss beim ersten Login geändert werden.

---

## Deploy-Script

Für einfaches Einspielen von Updates steht ein Deploy-Script bereit:

```bash
# Einmalig einrichten
cp scripts/deploy.sh /usr/local/bin/deploy
chmod +x /usr/local/bin/deploy

# Danach von überall ausführbar
deploy
```

Das Script führt automatisch `git pull`, Backend-Tests, Playwright-E2E-Tests (nur bei Frontend-Änderungen), Docker Build & Start und den Smoke-Test aus. Gebaut werden nur die Images, deren Verzeichnis (`backend/` bzw. `frontend/`) sich seit dem letzten erfolgreichen Deploy tatsächlich geändert hat (Merker in `.last-deploy`, nicht versioniert).

Beim allerersten Lauf lädt Playwright einmalig Chromium herunter (~115 MB) — das kann etwas dauern, wird danach aber gecached (`~/.cache/ms-playwright`). Host-seitige `node_modules` werden nach jedem Testlauf wieder gelöscht, um auf ressourcenknappen Servern Platz zu sparen.

---

## Tests

**Backend** (Vitest, 217 Tests):

```bash
cd backend
npm install
npm test
```

**Frontend E2E** (Playwright, prüft u.a. dass Task-Toggles den echten Server-Zustand widerspiegeln und nicht durch den Service-Worker-Cache verfälscht werden):

```bash
cd frontend
npm install
npx playwright install chromium
npm run test:e2e
```

Der E2E-Test startet automatisch einen eigenen Backend- (Port 3101) und Frontend-Preview-Server (Port 4173) gegen eine isolierte Wegwerf-Datenbank (`backend/e2e.db`) — keine Auswirkung auf die eigentliche Entwicklungs- oder Produktions-Datenbank.

---

## Datenbank-Backup

Tägliches Backup der SQLite-Datenbank (21 Tage Aufbewahrung):

```bash
# Cronjob einrichten (einmalig)
crontab -e
# Folgende Zeile einfügen:
# 0 3 * * * /opt/haushalts-app/scripts/backup.sh >> /var/log/haushalts-backup.log 2>&1

# Manuell testen
bash scripts/backup.sh
ls -lh /opt/backups/haushalts-app/
```

---

## Gmail App-Passwort einrichten

1. Google-Konto öffnen → Sicherheit
2. 2-Faktor-Authentifizierung aktivieren (falls noch nicht aktiv)
3. Suche nach „App-Passwörter"
4. Neues App-Passwort erstellen → den 16-stelligen Code in `SMTP_PASS` eintragen

---

## Cloudflare Tunnel einrichten

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Networks → Tunnels
2. Neuen Tunnel erstellen
3. Connector installieren (Docker-Befehl auf dem Server ausführen)
4. Public Hostname hinzufügen:
   - Domain: `haushalt.meinedomain.de`
   - Service: `http://localhost:80`
5. `FRONTEND_URL` in `.env` entsprechend setzen und Container neu starten

---

## App als PWA installieren

**Android (Chrome):** Menü → „Zum Startbildschirm hinzufügen"

**iOS (Safari):** Teilen-Symbol → „Zum Home-Bildschirm"

---

## Updates einspielen

```bash
deploy
```

oder manuell:

```bash
git pull
docker compose up --build -d
```

---

## Versionierung

Die aktuelle App-Version ist in `frontend/package.json` unter `version` hinterlegt und wird in den Einstellungen angezeigt. Bei größeren Änderungen bitte manuell hochzählen (Semantic Versioning: `MAJOR.MINOR.PATCH`).

Release Notes werden als [GitHub Releases](https://github.com/jbo2k15/haushalts-app/releases) veröffentlicht.
