# Haushalts-App

Mobile-first PWA für gemeinsames Haushaltsaufgaben-Management.

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
| `ADMIN_EMAIL` | Deine E-Mail-Adresse |
| `FRONTEND_URL` | Deine Domain (z.B. `https://haushalt.meinedomain.de`) |
| `SMTP_USER` | Gmail-Adresse |
| `SMTP_PASS` | Gmail App-Passwort (siehe unten) |
| `VAPID_PUBLIC_KEY` | Aus Schritt 2 |
| `VAPID_PRIVATE_KEY` | Aus Schritt 2 |
| `VAPID_EMAIL` | `mailto:deine@gmail.com` |
| `WASTE_ICAL_URL` | iCal-URL von EDG Dortmund |

### 4. App starten

```bash
docker compose up --build -d
```

Der erste Admin-Account wird automatisch angelegt:
- **E-Mail:** Wert aus `ADMIN_EMAIL`
- **Passwort:** `Haushalt2024!` (muss beim ersten Login geändert werden)

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
