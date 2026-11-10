---
description: Führt den kompletten Release-Prozess der haushalts-app aus (Version-Bump, Release-Notes, Tests, Tag, GitHub-Release)
argument-hint: <version, z.B. 1.9.4>
---

Führe einen vollständigen Release der haushalts-app für Version `$ARGUMENTS` durch.
Arbeite die Schritte der Reihe nach ab. Halte an den markierten Stellen an und
warte auf Bestätigung des Nutzers, bevor du weitermachst.

Wenn `$ARGUMENTS` leer ist: frage zuerst nach der Zielversion (Semver `x.y.z`)
und schlage anhand des letzten Tags und der Art der Änderungen einen
passenden Bump vor (Patch/Minor/Major).

## 0. Vorbereitung
- Prüfe mit `git status`, dass keine ungewollten uncommitteten Änderungen offen sind.
- `git pull` (bzw. `git fetch` + Vergleich): Parallel-Sessions oder der Server
  können committet haben. Falls neue Commits im Baum liegen, verschaffe dir
  einen Überblick (`git log --oneline`), damit die Release-Notes vollständig sind.
- Sammle die Änderungen seit dem letzten Tag (`git log <letzter-tag>..HEAD --oneline`),
  um Release-Notes und Tag-Text daraus abzuleiten.

## 1. Version-Bump
- Setze `version` auf `$ARGUMENTS` in `frontend/package.json` UND `backend/package.json`.
- Danach in **beiden** Ordnern `npm install --package-lock-only` ausführen
  (`cd backend`, dann `cd ../frontend`). Die `package-lock.json` enthält die
  Projektversion zweimal (Wurzel + `packages[""]`) und muss mitgezogen werden —
  sonst passt der wöchentliche Security-Scan sie später beim `npm audit fix`
  nebenbei an (so geschehen bei v1.17.0). Erwartete Änderung: genau diese zwei
  Zeilen pro Lockfile; zeigt `git diff --stat` deutlich mehr, Ursache klären
  (andere npm-Version?) statt blind zu committen.

## 2. Release-Notes-Entwurf — HALT, Freigabe nötig
- Formuliere eine kurze, nutzerorientierte deutsche Release-Note im Stil der
  bisherigen Einträge (nur nutzersichtbare Punkte; reine interne/Security-/
  Wartungs-Änderungen als "Im Hintergrund … — für dich als Nutzer ändert sich
  nichts an der Bedienung").
- **Zeige dem Nutzer den Entwurf und warte auf ausdrückliches OK/Anpassung,
  BEVOR du ihn speicherst.**
- Nach Freigabe: Eintrag `"$ARGUMENTS": "<text>"` ans Ende von
  `backend/src/data/release-notes.json` einfügen (gültiges JSON, `\n\n` für
  Absätze).

## 2b. README aktualisieren — verpflichtende Checkliste, nicht überspringen
Gehe für JEDES Release explizit diese vier Punkte durch (auch wenn das
Feature schon während der Entwicklung fertig wirkte — README-Pflege wird
dort erfahrungsgemäß vergessen, weil kein Release-Lauf stattfand):

1. **Funktionsliste** (`## Funktionen`) — bringt dieses Release ein
   nutzersichtbares Feature oder eine Verhaltensänderung? Falls ja: neuer
   Punkt bzw. angepasste Formulierung.
2. **ENV-Variablen-Tabelle** (Abschnitt „3. `.env`-Datei erstellen") —
   wurde seit dem letzten Tag eine neue ENV-Variable eingeführt
   (`grep -n "process.env\." backend/src -r` grob gegen die Tabelle
   abgleichen, oder gezielt `git log <letzter-tag>..HEAD -p -- backend/.env.example`
   prüfen)? Falls ja: Zeile in der Tabelle ergänzen (Name + kurze
   Beschreibung + optional/Default).
3. **Sonstige Abschnitte** (Ablauf, Voraussetzungen, Deploy-Schritte) — nur
   falls das Release daran etwas ändert.
4. **Begleitskripte bei geändertem API-Verhalten** — antwortet ein Endpunkt
   seit dem letzten Tag anders (anderer Statuscode, neue/entfernte Route)?
   Dann `scripts/smoke-test.sh` gegenlesen: der Smoke-Test läuft nach jedem
   Deploy und lässt ihn bei einer veralteten Erwartung rot werden, obwohl die
   App korrekt läuft (so geschehen 2026-11-10 mit der abschaltbaren
   Registrierung). Neue Routen müssen außerdem in
   `backend/tests/routes/authz-matrix.test.js` eingestuft sein (der Test
   erzwingt das).
- Falls README-Anpassungen für dieses Feature bereits vorab (außerhalb eines
  /release-Laufs) gemacht wurden: hier nur verifizieren, dass alle drei
  Punkte abgedeckt sind, nicht doppelt einfügen.
- Reine Bugfixes, Performance- oder interne Änderungen ohne neue ENV-Variable
  brauchen i. d. R. keine README-Änderung — dann kurz explizit vermerken,
  dass alle drei Punkte geprüft wurden und nichts anzupassen war (nicht
  stillschweigend überspringen).
- In der README steht keine hartcodierte Versionsnummer (die lebt in
  `package.json`), es muss dort also nichts hochgezählt werden.

## 3. Tests — müssen grün sein
- Backend: `cd backend && npm test` (Vitest).
  - Schlagen **alle** Tests sofort mit `Cannot read properties of undefined
    (reading 'deleteMany')` fehl, ist der lokale Prisma-Client älter als das
    Schema → `npx prisma generate` im Ordner `backend`, dann erneut.
- Frontend E2E: `cd frontend && npm run test:e2e` (Playwright) — lange laufend,
  ggf. im Hintergrund starten und auf Abschluss warten.
  - Brechen **alle** Tests nach ~1 ms mit `Executable doesn't exist … ms-playwright`
    ab, fehlt nach einem Playwright-Update der Browser → den Nutzer bitten,
    `npx playwright install chromium` auszuführen (Download nicht ungefragt
    starten), dann erneut.
- Bei roten Tests: NICHT taggen. Ursache melden und mit dem Nutzer klären.
- Testzahlen für Tag-Text und Release-Beschreibung aus der Ausgabe notieren.

## 4. Artefakte aufräumen (vor dem Commit)
Lösche generierte Test-Artefakte (alle stehen in `.gitignore`, sollen aber
nicht liegen bleiben). Die Datenbanken laufen im WAL-Modus, die Sidecar-Dateien
heißen daher `-wal`/`-shm`, nicht mehr `-journal`:
- `backend/e2e.db`, `backend/e2e.db-wal`, `backend/e2e.db-shm`, `backend/e2e-emails.jsonl`
- `backend/test.db`, `backend/test.db-wal`, `backend/test.db-shm`
- `frontend/test-results`, `frontend/dist`
- Danach muss `git status --short` nur die Release-Dateien zeigen.

## 5. Commit
- Committe die Release-Dateien (beide `package.json`, beide `package-lock.json`, `release-notes.json`,
  ggf. `README.md` und TODO.md) als `chore(release): v$ARGUMENTS` mit einer
  Zusammenfassung der Änderungen seit dem letzten Release.
- Commit-Message-Footer: die `Co-Authored-By`-Zeile, die die laufende Session
  vorgibt (Modellname nicht fest hier eintragen — er veraltet).

## 6. Push, CI und Auto-Deploy abwarten — erst danach taggen
Ein Push auf `main` löst die CI aus und deployt nach grünen Jobs **automatisch**
auf den Server (Job „Deploy (self-hosted)“, inkl. Pre-Deploy-Backup und
Smoke-Test). Der Tag soll nur auf einen Stand zeigen, der wirklich ausgerollt
ist.
- `git push`.
- CI-Lauf zum Commit ermitteln und abwarten:
  `gh run list --repo jbo2k15/haushalts-app --commit <sha> --workflow ci.yml --json databaseId`,
  dann `gh run watch <id> --repo jbo2k15/haushalts-app --exit-status` (Timeout ~10 min),
  dann `gh run view <id> --repo jbo2k15/haushalts-app --json jobs --jq ".jobs[] | {name, conclusion}"`.
- Alle vier Jobs müssen `success` sein, danach
  `curl.exe -s -o NUL -w "%{http_code}" https://haushalt-braun.org/api/health` → `200`.
- Ein Job rot: NICHT taggen. Fehlerausgabe holen
  (`gh run view <id> --repo jbo2k15/haushalts-app --log-failed`), dem Nutzer
  melden. Schlägt nur der Smoke-Test fehl, laufen die neuen Container bereits —
  es gibt kein automatisches Zurückrollen (Abhilfe: Ursache beheben oder
  `git revert` + Push). Nicht selbst reverten.

## 6b. Annotierter Tag
- Erzeuge einen **annotierten** Tag `v$ARGUMENTS` auf dem Release-Commit mit
  detaillierten technischen Release-Notes (Features/Fixes seit letztem Tag +
  "Tests: X Backend, Y E2E, alle grün").
- `git push origin v$ARGUMENTS` (ein Tag-Push löst keinen weiteren Deploy aus).
- Falls der Tag remote bereits existiert und auf einen falschen Commit zeigt:
  NICHT blind force-pushen — das mit dem Nutzer klären.

## 7. GitHub-Release
- `gh` ist installiert und über den Windows-Schlüsselbund angemeldet:
  Markdown-Beschreibung (nutzersichtbare Punkte + technische Details +
  Testergebnis) in eine temporäre Datei schreiben, dann
  `gh release create v$ARGUMENTS --repo jbo2k15/haushalts-app --title "v$ARGUMENTS" --notes-file <datei> --verify-tag`.
- Falls `gh` nicht verfügbar ist (`gh auth status` schlägt fehl): dem Nutzer
  den Link `https://github.com/jbo2k15/haushalts-app/releases/new?tag=v$ARGUMENTS`
  plus Titel und Beschreibung zum Einfügen geben.

## 8. Abschlusshinweis
- Nenne das Ergebnis aus Schritt 6 (CI grün, Deploy ok, Health 200).
- Erinnere daran: Der Deploy ist bereits gelaufen, der neue Build muss aber im
  Browser aktiv werden — die
  installierte PWA einmal komplett schließen/neu öffnen (Service-Worker-
  Lifecycle), damit Versionsanzeige im Footer und Release-Notes-Modal greifen.
