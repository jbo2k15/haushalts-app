# Haushalts-App

Mobile-first PWA für gemeinsames Haushaltsaufgaben-Management.

## Funktionen

- **Aufgaben** — Jede Aufgabe hat einen Aufwand (Leicht/Mittel/Aufwändig, Standard Mittel), der in Fairness-Statistik und optional in Rangliste und Statistik zählt. Tägliche, wöchentliche (optional an einem festen Wochentag), monatliche (konfigurierbar alle 1–12 Monate, optional an einem festen Tag im Monat — bei 29.–31. in kürzeren Monaten am Monatsletzten) und einmalige Aufgaben (mit Fälligkeitsdatum); Aufgaben mit festem Wochen- bzw. Monatstag erscheinen erst ab diesem Tag; Drag & Drop zum Sortieren; tägliche Aufgaben können für den Tag übersprungen werden — sie bleiben dann ausgegraut sichtbar und lassen sich zurückholen; an bestimmte Wochentage gebundene Aufgaben bleiben nach einem verpassten Tag noch als überfällig sichtbar; nicht erledigte Monatsaufgaben verfallen zum Monatswechsel, danach gilt der nächste reguläre Termin (eine Änderung des Turnus berechnet den nächsten Termin neu)
- **Mehrfach erledigbare Aufgaben** — Tägliche und wöchentliche Aufgaben können bei Bedarf per Verwaltung so konfiguriert werden, dass sie mehrmals pro Tag/Woche erledigt werden können, mit Zähler und der Möglichkeit, die letzte Erledigung zurückzunehmen
- **Aufgabenlog** — Protokoll aller erledigten, abgelaufenen, übersprungenen und gelöschten Aufgaben (bis 100 Einträge); wird eine Aufgabe gelöscht, bleiben ihre bisherigen Erledigungen in Log, Statistik und Pokalen erhalten
- **Statistiken** — Erledigte Aufgaben pro Nutzer für heute, die laufende Woche und den laufenden Monat — wahlweise als Anzahl oder als Aufwands-Punkte (Admin-Einstellung „Zählweise“)
- **Ruhmeshalle** — Gesamtranking mit Trophäen für Tages-, Wochen- und Monatssieger (nach Anzahl oder Aufwands-Punkten, je nach Zählweise; beim Umstellen werden die Pokale aus dem gespeicherten Verlauf neu berechnet); per Wisch-Geste (links/rechts, Touch oder Maus) direkt von der Startseite erreichbar
- **Fairness-Statistik** — Karte in der Ruhmeshalle mit dem Anteil jeder Person an den erledigten Aufgaben der letzten 30 Tage, gewichtet nach Aufwand (Leicht/Mittel/Aufwändig pro Aufgabe), mit Trend und 4-Wochen-Verlauf; Urlaubszeiten (aus dem Urlaubsmodus oder vom Admin nachgetragen) werden herausgerechnet. Ein Admin kann einstellen, ob Rangliste (Pokale) und Statistik nach Anzahl oder nach Aufwands-Punkten zählen. Nur für Nutzer sichtbar, die ein Admin freigibt; komplett abschaltbar per `FAIRNESS_ENABLED=false` (Entfernen: `docs/fairness-entfernen.md`)
- **Navigation** — Bottom-Navigation (unten) mit direktem Zugriff auf Aufgaben, Vorrat, Ruhmeshalle, Einstellungen und (für Admins) Verwaltung; zwischen Aufgaben und Ruhmeshalle zusätzlich per Wisch-Geste (links/rechts, Touch oder Maus). Der Browser-/System-Zurück-Pfeil verlässt Einstellungen/Verwaltung/Vorrat zuverlässig, auf der Startseite fragt er erst nach, ob die App wirklich geschlossen werden soll (abschaltbar)
- **Vorratsschrank** — Lagerorte (z.B. Kühlschrank, Vorratsschrank; für Admins über ein eigenes Verwalten-Menü anlegbar/umbenennbar/sortierbar) als horizontal wechselbare Auswahl, damit immer nur ein Ort auf einmal angezeigt wird; darin frei anlegbare Kategorien (mit klebenbleibendem Header beim Scrollen) und Artikel (Menge — auch mit Komma, z. B. 1,5 kg —, Einheit, optionale eigene Mindestmenge je Artikel oder Kategorie-Standardwert), jeweils per Drag & Drop sortierbar, wahlweise umschaltbar auf eine Sortierung nach dringlichstem Nachkaufbedarf. Artikel bei/unter der Mindestmenge erscheinen automatisch in einer Einkaufsliste, lösen einen Hinweis auf der Startseite aus und eine einmalige Push-Benachrichtigung, sobald sie neu knapp werden
- **Erscheinungsbild** — Hell/Dunkel/System-Design sowie eine stufenweise anpassbare Textgröße (Zoom), beides unter Einstellungen konfigurierbar und geräteweise gespeichert
- **Push-Benachrichtigungen** — Tägliche, wöchentliche und monatliche Erinnerungen an offene Aufgaben (Tag/Uhrzeit legt ein Admin für den ganzen Haushalt fest); die tägliche Erinnerung nennt auch überfällige Wochentags-Aufgaben sowie Wochen- und Monatsaufgaben, deren fester Tag heute ist; bei bis zu drei offenen Aufgaben werden deren Namen genannt, sonst nur die Anzahl. Genannt werden nur Aufgaben, die auch in der Liste gerade offen stehen (keine übersprungenen, pausierten oder laut Turnus noch nicht fälligen)
- **Abfallkalender** — Einmalige Aufgaben aus iCal-Feed für jeden konkreten Abholtermin; werden mehrmals täglich synchronisiert und bis zu eine Woche im Voraus vorgemerkt (robust gegen kurzzeitige Ausfälle des Feed-Dienstes). Ab 3 Tagen vor der Abholung erscheinen sie als Vorschau in der Aufgabenliste, ab dem Tag vor der Abholung sind sie abhakbar; laufen am Folgetag automatisch ab und erscheinen im Log als „verfallen". Eine im Feed nicht erkannte Tonnenbezeichnung wird per Push an Admins gemeldet und in der Verwaltung angezeigt, statt stillschweigend keine Aufgabe zu erzeugen
- **Wetterabhängige Aufgaben** — Tägliche Aufgaben (z.B. „Blumen gießen") können als wetterabhängig markiert werden und entfallen automatisch, sobald seit Mitternacht eine konfigurierbare Regenmenge überschritten wurde (alle 15 Minuten geprüft, Open-Meteo, kein API-Key nötig); Verwaltung zeigt den aktuellen Wetter-Status, Benachrichtigung dazu ist pro Nutzer ein-/ausschaltbar
- **Pausenzeitraum für Aufgaben** — Tägliche, wöchentliche und monatliche Aufgaben können für einen Zeitraum pausiert werden, einzeln pro Aufgabe oder haushaltsweit über eine „Alle Aufgaben pausieren"-Karte in der Verwaltung; pausierte Aufgaben verschwinden für den Zeitraum aus der Übersicht (Sammelzeile zeigt die Anzahl), einmalige Aufgaben und Abfallkalender-Termine sind davon ausgenommen
- **Urlaubsmodus** — Pausiert Benachrichtigungen für einzelne Nutzer und hält die Urlaubszeit fest, damit sie in der Fairness-Statistik herausgerechnet wird (Ein- und Ausschalttag zählen als normale Tage)
- **Export / Import** — Aufgaben als JSON exportieren und importieren (max. 200 Aufgaben)
- **Nutzerverwaltung** — Registrierung mit Admin-Freischaltung, Rollenverwaltung, Sperren/Entsperren, Löschen; die Selbst-Registrierung ist standardmäßig aus und wird von einem Admin in den Einstellungen ein- und ausgeschaltet, Admins erhalten bei jeder neuen Registrierung eine Push-Nachricht, nie freigeschaltete Registrierungen werden nach 10 Tagen gelöscht
- **Passwort-Reset** — Per E-Mail-Link; invalidiert automatisch alle aktiven Sessions
- **PWA** — Installierbar auf Android und iOS; funktioniert nach Erstladen auch offline (statische Assets)
- **Echtzeit-Sync** — Änderungen anderer Nutzer erscheinen sofort per Server-Sent Events, mit Fallback-Polling
- **Barrierefreiheit** — Per Tastatur bedienbar (inkl. Abhaken von Aufgaben und Sortieren per Drag & Drop), Screenreader-Ansagen bei Änderungen durch andere Nutzer, echte Überschriften und beschriftete Formulare/Dialoge (Escape schließt), die nicht angezeigte Seite der Wisch-Ansicht ist für Tastatur und Screenreader ausgeblendet, Touch-Ziele mindestens 44 px, WCAG-AA-Kontraste in Hell und Dunkel; automatisierte axe-Prüfung der zentralen Seiten (inkl. Anmeldung, Registrierung, Passwort vergessen) in der CI
- **Sicherheit** — Rate-Limiting (pro Endpunkt und echter Client-IP, auch hinter dem Cloudflare Tunnel), Kontosperre für 15 Minuten nach 5 Fehlversuchen, Honeypot gegen Bot-Registrierungen, timing-safe Login/Passwort-Reset, serverseitige Eingabevalidierung, Protokoll jedes Login-Fehlversuchs (IP + maskierte E-Mail) und Warnung bei gehäuften Fehlversuchen inkl. häufigster IPs/Konten

---

## Voraussetzungen

- Docker + Docker Compose
- Node.js 24 und npm (wie in CI und Docker-Images; für Backend-Tests und Playwright-E2E-Tests, die `deploy.sh` beim manuellen Deploy vor dem Build ausführt)
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
| `FAIRNESS_ENABLED` | `false` schaltet die Fairness-Statistik komplett ab (Karte, Aufwand-Auswahl, Urlaubszeiten); optional, Default an |

**Registrierung:** Die Selbst-Registrierung ist standardmäßig **aus** (`POST /api/auth/register` antwortet mit 404, der Link auf der Anmeldeseite entfällt). Um ein neues Mitglied aufzunehmen, schaltet ein Admin sie unter *Einstellungen → Nutzerverwaltung → Registrierung erlauben* ein, lässt das Konto anlegen, schaltet es frei und schaltet die Registrierung wieder aus. Admins bekommen bei jeder neuen Registrierung eine Push-Nachricht; nie freigeschaltete Registrierungen werden nach 10 Tagen automatisch gelöscht.

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

### Automatischer Deploy (self-hosted Runner)

Optional: Ein Push nach `main` kann nach grüner CI automatisch deployen. Dafür läuft in LXC 103 ein GitHub-Actions-Runner (Label `proxmox-prod`, als root, weil `deploy.sh` apt/Docker-Volumes braucht). Der Job `deploy` in `.github/workflows/ci.yml` ruft `scripts/deploy.sh` mit `SKIP_CI_CHECK=1` (CI-Lauf ist der Aufrufer selbst), `SKIP_TESTS=1` (CI hat getestet) und `NOTIFY_ON_FAILURE=1` (Push an Admins bei Fehler) auf. Das gilt seit 2026-11-10 auch für Commits `chore: auto security patch` des Security-Scans (vorher ausgenommen) – ein automatisches Zurückrollen gibt es nicht: bei einem fehlgeschlagenen Deploy den Patch-Commit per `git revert` zurücknehmen und pushen.

- Vor jedem Deploy legt `deploy.sh` ein Backup `haushalt-<Datum>-predeploy-<HHMM>.db.gz` an.
- Runner-Status: `systemctl status 'actions.runner.*'` (Logs: `journalctl -u 'actions.runner.*' -n 50`).
- Runner offline → Deploy-Job wartet in der Queue; der manuelle `deploy` hängt dann am CI-Gate: `SKIP_CI_CHECK=1 deploy`.
- Deploy bricht mit `npm error code ECONNRESET` beim Docker-Build ab → kurzer Netzwerkfehler des Servers, kein Code-Problem: den fehlgeschlagenen Job in GitHub Actions einfach neu starten („Re-run failed jobs“). Die alten Container laufen bis dahin weiter.
- Voraussetzung (öffentliches Repo!): GitHub → Settings → Actions → General → „Require approval for all outside collaborators“. Zusätzlich sind Pull Requests auf „Collaborators only“ beschränkt (Settings → General → Features); Dependabot kann trotzdem PRs anlegen.

Beim allerersten Lauf lädt Playwright einmalig Chromium herunter (~115 MB) — das kann etwas dauern, wird danach aber gecached (`~/.cache/ms-playwright`). Host-seitige `node_modules` bleiben zwischen Deploys erhalten (`npm ci` läuft nur erneut, wenn sich die jeweilige `package-lock.json` seit dem letzten Deploy geändert hat oder `node_modules` noch fehlt) — kostet dauerhaft ca. 500 MB Platz, spart aber die volle Neuinstallation bei jedem Deploy ohne Dependency-Änderung.

---

## Tests

**Backend** (Vitest):

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

## Host-Check

`scripts/host-check.sh` prüft den Server rein lesend: ausstehende (Sicherheits-)Updates und automatische Updates, ausstehender Neustart, unerwartet lauschende Ports, SSH-Einstellungen, Plattenplatz, Zustand und Härtung der Container, Tunnel- und Runner-Dienst, Rechte der `.env`, Alter und Lesbarkeit des letzten Backups, Alter des Trivy-Logs. Exit-Code 0 = ok, 1 = Warnungen, 2 = Fehler.

```bash
# Im App-Container (LXC)
bash scripts/host-check.sh

# Auf dem Proxmox-Host selbst (ohne Docker-/App-Prüfungen)
HOST_ROLE=proxmox bash host-check.sh

# Wöchentlich per Cron, nur Auffälligkeiten ins Log
# 30 5 * * 1 /opt/haushalts-app/scripts/host-check.sh --quiet >> /var/log/haushalts-host-check.log 2>&1
```

## Container-CVEs (Trivy)

Der Workflow `.github/workflows/trivy.yml` scannt montags auf dem self-hosted Runner die gebauten Images mit Trivy (HIGH/CRITICAL, `.trivyignore` wird beachtet) und lädt die Ergebnisse nach GitHub Code Scanning hoch (Security → Code scanning, Tool „Trivy“). Manuell: `gh workflow run trivy.yml`. Behoben werden Funde in der Regel durch einen Rebuild (`deploy`).

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

Echte Client-IP: Läuft `cloudflared` auf dem Docker-Host (oder in einem Docker-Netz), übernimmt nginx die Besucher-IP aus dem Header `CF-Connecting-IP` (`set_real_ip_from 172.16.0.0/12` in `frontend/nginx.conf`). Rate-Limiting und Login-Protokoll arbeiten dadurch pro echter IP. Läuft der Tunnel auf einer anderen Maschine im LAN, muss deren Adresse dort zusätzlich eingetragen werden — sonst greift das Rate-Limit für alle Besucher gemeinsam.

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

Die App-Version steht in `frontend/package.json` und `backend/package.json` (Semantic Versioning: `MAJOR.MINOR.PATCH`) und wird in der App angezeigt. Releases laufen über den Claude-Code-Befehl `/release <version>` (`.claude/commands/release.md`): Version in beiden `package.json` und `package-lock.json` hochzählen, nutzerorientierte Release-Note in `backend/src/data/release-notes.json` (erscheint nach dem Update einmalig in der App), README-Checkliste, Tests, annotierter Tag.

Technische Release Notes werden zusätzlich als [GitHub Releases](https://github.com/jbo2k15/haushalts-app/releases) veröffentlicht.

---

## Lizenz

© 2026 jbo2k15. Alle Rechte vorbehalten.

Der Quellcode ist öffentlich einsehbar, steht aber unter keiner Open-Source-Lizenz. Kopieren, Weiterverwenden oder Weiterverbreiten — ganz oder in Teilen — ist ohne ausdrückliche Erlaubnis nicht gestattet.
