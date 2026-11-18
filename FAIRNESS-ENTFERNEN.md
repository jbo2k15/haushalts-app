# Fairness-Statistik abschalten oder entfernen

Die Fairness-Statistik ist so gebaut, dass sie sich in zwei Stufen loswerden
lässt. Spezifikation: `TODO.md`, Abschnitt „Fairness-Transparenz in der
Ruhmeshalle“.

## Stufe 1: Abschalten (jederzeit, ohne Code-Änderung)

In der `.env` im Projektordner auf dem Server (`/opt/haushalts-app/.env`, die Datei, die `docker-compose.yml` als `env_file` einbindet — nicht `backend/.env`):

```
FAIRNESS_ENABLED=false
```

Danach den Backend-Container neu starten. Wirkung:

- Die Karte in der Ruhmeshalle, die Aufwand-Auswahl und -Badges in der
  Verwaltung, der Einstufungs-Hinweis und der Abschnitt „Fairness-Statistik“
  in den Einstellungen verschwinden.
- Alle `/api/fairness/*`-Routen antworten mit 404 (außer `/config`, das
  `enabled: false` meldet).
- Der Urlaubsmodus schreibt keine Urlaubszeiten mehr mit.
- Rangliste (Pokale) und Statistik zählen wieder nach Anzahl, egal welche
  Zählweise eingestellt war (die Pokale passen sich beim nächsten
  nächtlichen Neuberechnen bzw. Neustart an).
- Die Daten bleiben erhalten. `FAIRNESS_ENABLED` wieder entfernen schaltet
  alles mit dem alten Stand wieder ein.

## Stufe 2: Komplett entfernen (Code und Datenbank)

### Dateien löschen

- `backend/src/domain/fairness.js`
- `backend/src/routes/fairness.js`
- `backend/tests/domain/fairness.test.js`
- `backend/tests/routes/fairness.test.js`
- `frontend/src/components/fairness/` (ganzer Ordner)
- `frontend/e2e/fairness.spec.js`
- diese Datei

### Aufrufstellen entfernen

Jede Stelle ist im Code mit `Fairness-Statistik` kommentiert
(`grep -rn "Fairness-Statistik" backend/src frontend/src`):

- `backend/src/app.js`: Import und `app.use('/api/fairness', …)`
- `backend/src/routes/users.js`: Import und Aufruf von `recordVacationToggle`
- `backend/src/domain/display.js`: Import und Aufruf von `getCountMode` (Punktestand am Familien-Display; ohne Fairness dort fest nach Anzahl zählen)
- `backend/src/services/scheduler.js`: Import von `getCountMode`/`withPoints`,
  in `updateTrophyCache` und `pruneOldTaskLogs` wieder nur
  `{ completedBy, loggedAt }` laden (ohne `withPoints`)
- `backend/src/lib/trophies.js`: `log.points ?? 1` kann bleiben (zählt ohne
  Punkte wie bisher 1) oder zurück auf `+ 1`
- `backend/src/domain/tasks.js`: Import aus `./fairness.js`,
  `difficulty` in `validateTaskInput`/`createTask`/`updateTask`/
  `importTasks`/`exportTasks`, `...logWeightFields(task)` in
  `createCompletion`, `syncLegacyWeights` in `updateTask`, `getCountMode` und
  der `countMode`-Parameter von `completedCountsByUser` in `getStats`
- `backend/tests/setup.js`: `vacationPeriod.deleteMany()`, `fairnessSettings.deleteMany()`
- `backend/tests/lib/trophies.test.js`: Block „mit Punkten (gewichtete Zählweise)“
- `frontend/src/pages/HallOfFame.jsx`: `<FairnessCard />`, `<CountModeNote />`,
  `useFairnessConfig` (Abhängigkeit des Stats-Effekts zurück auf `[]`)
- `frontend/src/components/StatsSection.jsx`: `useFairnessConfig`, „· Punkte“
- `frontend/src/pages/Admin.jsx`: `<RatingHint />`, `difficulty` in `startEdit`
- `frontend/src/pages/Settings.jsx`: `<FairnessAdminSection />`
- `frontend/src/components/admin/TaskFormFields.jsx`: `<DifficultyField />`
- `frontend/src/components/admin/SortableTask.jsx`: `<DifficultyBadge />`
- `frontend/src/components/admin/constants.js`: `difficulty` in `EMPTY_FORM`
- `README.md` (Funktion + `FAIRNESS_ENABLED`), `.env.example`, `backend/.env.example`

### Datenbank zurückbauen

Die Migrationen `20261110100000_fairness` und
`20261110120000_fairness_count_mode` **nicht** löschen (Prisma kennt sie
bereits als angewendet). Stattdessen in `backend/prisma/schema.prisma` die
Felder `User.showFairness`, `User.vacationPeriods`, `Task.difficulty`,
`TaskLog.weight`, `TaskLog.weightFromTask` und die Modelle `VacationPeriod`
und `FairnessSettings`
entfernen und eine neue Migration anlegen, z. B.
`backend/prisma/migrations/<datum>_remove_fairness/migration.sql`:

```sql
DROP TABLE "VacationPeriod";
DROP TABLE "FairnessSettings";
ALTER TABLE "Task" DROP COLUMN "difficulty";
ALTER TABLE "User" DROP COLUMN "showFairness";
ALTER TABLE "TaskLog" DROP COLUMN "weight";
ALTER TABLE "TaskLog" DROP COLUMN "weightFromTask";
```

(SQLite kann `DROP COLUMN`, solange die Spalte weder indiziert noch
Fremdschlüssel ist – das trifft auf alle fünf Spalten zu.)

Der Kommentar in der Migration `20261110100000_fairness` nennt noch den früheren Pfad dieser Anleitung (`docs/fairness-entfernen.md`). Er bleibt so stehen: bereits angewendete Migrationen werden nicht mehr verändert.

### Was bleibt (bewusst)

Die vorbereitende Änderung „Löschen einer Aufgabe löscht nicht mehr ihre
Historie“ (Migration `20261110090000_tasklog_keep_history`, `TaskLog.taskType`,
`EXCLUDE_ONCE`) gehört nicht zur Fairness-Statistik und bleibt: Statistik,
Pokale und Verlauf kippen sonst beim Löschen einer Aufgabe wieder rückwirkend.
