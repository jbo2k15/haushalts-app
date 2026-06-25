# Haushalts-App

Mobile-first PWA für gemeinsames Haushaltsaufgaben-Management.

## Funktionen

- **Aufgaben** — Tägliche, wöchentliche, monatliche und einmalige Aufgaben (mit Fälligkeitsdatum); Drag & Drop zum Sortieren (Desktop & Mobil)
- **Aufgabenlog** — Protokoll aller erledigten und abgelaufenen Aufgaben (bis 100 Einträge)
- **Statistiken** — Erledigte Aufgaben pro Nutzer für heute, diese Woche, letzte Woche, diesen und letzten Monat
- **Ruhmeshalle** — Gesamtranking mit Trophäen für Tages-, Wochen- und Monatssieger; Trophäen werden nur für abgeschlossene Perioden vergeben
- **Push-Benachrichtigungen** — Tägliche und wöchentliche Erinnerungen an offene Aufgaben
- **Abfallkalender** — Anzeige kommender Abholtermine via iCal-Feed
- **Urlaubsmodus** — Pausiert Benachrichtigungen für einzelne Nutzer
- **Export / Import** — Aufgaben als JSON exportieren und importieren (max. 200 Aufgaben)
- **Nutzerverwaltung** — Registrierung mit Admin-Freischaltung, Rollenverwaltung, Account sperren/entsperren
- **Passwort-Reset** — Per E-Mail-Link; invalidiert automatisch alle aktiven Sessions

---

## Voraussetzungen

- Docker + Docker Compose installiert
- Git installiert
- Cloudflare-Account (für externen Zugriff)
- Gmail-Account mit App-Passwort

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
```

Die ausgegebenen Keys in die `.env`-Datei eintragen.

### 3. `.env`-Datei erstellen

```bash
cp .env.example .env
```

Alle Werte in `.env` ausfüllen:

| Variable | Beschreibung |
|---|---|
| `JWT_SECRET` | Langer zufälliger String (z.B. `openssl rand -hex 32`) |
| `ADMIN_EMAIL` | E-Mail-Adresse des ersten Admin-Accounts |
| `ADMIN_PASSWORD` | Initiales Admin-Passwort (min. 10 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen) |
| `FRONTEND_URL` | Deine Domain (z.B. `https://haushalt.meinedomain.de`) |
| `SMTP_USER` | Gmail-Adresse |
| `SMTP_PASS` | Gmail App-Passwort (siehe unten) |
| `VAPID_PUBLIC_KEY` | Aus Schritt 2 |
| `VAPID_PRIVATE_KEY` | Aus Schritt 2 |
| `VAPID_EMAIL` | `mailto:deine@gmail.com` |
| `WASTE_ICAL_URL` | iCal-URL des Abfallkalenders |

### 4. App starten

```bash
docker compose up --build -d
```

Der erste Admin-Account wird automatisch mit den Werten aus `ADMIN_EMAIL` und `ADMIN_PASSWORD` angelegt. Das Passwort muss beim ersten Login geändert werden.

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
3. Connector installieren (Docker-Befehl kopieren und auf dem Server ausführen)
4. Public Hostname hinzufügen:
   - Domain: `haushalt.meinedomain.de`
   - Service: `http://localhost:80`
5. `FRONTEND_URL` in `.env` entsprechend setzen und Container neu starten:
   ```bash
   docker compose up -d --build
   ```

---

## App als PWA installieren (Android)

1. Chrome öffnen und zur App-URL navigieren
2. Menü → „Zum Startbildschirm hinzufügen"

---

## Updates einspielen

```bash
git pull
docker compose up --build -d
```
