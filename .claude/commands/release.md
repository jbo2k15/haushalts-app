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
- `package-lock.json` nur anfassen, wenn sich Dependencies geändert haben
  (reiner Version-Bump ändert die Lockfiles nicht — Caret-Ranges decken es ab).

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

## 3. Tests — müssen grün sein
- Backend: `cd backend && npm test` (Vitest).
- Frontend E2E: `cd frontend && npm run test:e2e` (Playwright) — lange laufend,
  ggf. im Hintergrund starten und auf Abschluss warten.
- Bei roten Tests: NICHT taggen. Ursache melden und mit dem Nutzer klären.

## 4. Artefakte aufräumen (vor dem Commit)
Lösche generierte Test-Artefakte, damit sie nicht in den Commit geraten:
- `backend/e2e.db`, `backend/e2e.db-journal`, `backend/e2e-emails.jsonl`
- `backend/test.db`, `backend/test.db-journal`
- `frontend/test-results`, `frontend/dist`

## 5. Commit + annotierter Tag
- Committe die Release-Dateien (beide `package.json`, `release-notes.json`,
  ggf. TODO.md) mit einer Zusammenfassung der Änderungen seit dem letzten Release.
- Erzeuge einen **annotierten** Tag `v$ARGUMENTS` mit detaillierten technischen
  Release-Notes (Features/Fixes seit letztem Tag + "Tests: X Backend, Y E2E, alle grün").
- Commit-Message-Footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## 6. Push
- `git push` und `git push origin v$ARGUMENTS`.
- Falls der Tag remote bereits existiert und auf einen falschen Commit zeigt:
  NICHT blind force-pushen — das mit dem Nutzer klären.

## 7. GitHub-Release (manuell — `gh` ist nicht installiert)
- Gib dem Nutzer den fertigen Link
  `https://github.com/jbo2k15/haushalts-app/releases/new?tag=v$ARGUMENTS`
  plus Titel (`v$ARGUMENTS`) und eine Markdown-Beschreibung (nutzersichtbare
  Punkte + technische Details + Testergebnis) zum Einfügen.

## 8. Abschlusshinweis
- Erinnere daran: Nach dem Deploy muss der neue Build aktiv werden — die
  installierte PWA einmal komplett schließen/neu öffnen (Service-Worker-
  Lifecycle), damit Versionsanzeige im Footer und Release-Notes-Modal greifen.
