# Offene Aufgaben

## Aus wöchentlichem Security-/Dependency-Scan (2026-07-06)

- [x] **Major-Update `vite` 7 → 8 + `@vitejs/plugin-react` 4 → 6** (frontend) — erledigt (2026-07-06). Installiert mit `--legacy-peer-deps` (der ERESOLVE-Konflikt betraf nur eine ungenutzte optionale Peer-Dependency von `@vitejs/plugin-react@6`, `@rolldown/plugin-babel`, die `@babel/core@8-rc` verlangt, während `vite-plugin-pwa` an `@babel/core@7` hängt — npm installiert beide Versionen parallel, keine echte Inkompatibilität). Build + volle 11er-E2E-Suite (inkl. Service-Worker-Verhalten) grün.
- [ ] **Deprecation-Warnung `inlineDynamicImports` von `vite-plugin-pwa`** (frontend) — seit Vite 8: `vite-plugin-pwa@1.3.0` (aktuellste Version) setzt beim internen Service-Worker-Build noch die alte Rollup-Option `output.inlineDynamicImports: true` statt Vites neuer `build.codeSplitting: false`. Hartcodiert in `node_modules/vite-plugin-pwa/dist/vite-build-*.js`, nicht über unsere `vite.config.js` überschreibbar. Nur eine Warnung, keine Fehlfunktion. Beheben, sobald `vite-plugin-pwa` ein Vite-8-Kompatibilitäts-Release bringt — Changelog bei nächstem Scan prüfen.
- [x] **Major-Update `react-router` 7 → 8** (frontend) — erledigt (2026-07-06). Laut Upgrade-Guide ein "non-breaking" Sprung, sofern man bereits `react-router` statt dem in v8 entfernten `react-router-dom` nutzt (bei uns der Fall) und die neuen Baselines (Node 22+, React 19+, Vite 7+) erfüllt sind (bei uns der Fall dank Node 24, React 19.2.7, Vite 8). Genutzte `future`-Flags (`v7_startTransition`, `v7_relativeSplatPath`) sind v7-Flags, keine der entfernten `v8_*`-Flags — unverändert übernommen. `npm install react-router@8` lief ohne Peer-Konflikte durch. Build + volle 11er-E2E-Suite (inkl. Routing/Navigation-Tests) grün.
- [x] **Major-Update `tailwindcss` 3 → 4** (frontend) — erledigt (2026-07-06) via offiziellem `npx @tailwindcss/upgrade`-Tool. Wichtigster Punkt: `darkMode: 'class'` gibt es in v4 nicht mehr als JS-Config-Option — das Tool hat automatisch `@custom-variant dark (&:is(.dark *));` in `index.css` ergänzt, damit der manuelle Hell/Dunkel/System-Umschalter (togglet `.dark`-Klasse auf `<html>`) weiter funktioniert statt nur auf OS-`prefers-color-scheme` zu reagieren. `tailwind.config.js` entfernt (CSS-first `@theme`/`@import "tailwindcss"`), `@tailwindcss/postcss` als neues PostCSS-Plugin-Paket ergänzt. Utility-Umbenennungen automatisch migriert (`flex-shrink-0`→`shrink-0`, `rounded`→`rounded-sm` wegen verschobener Border-Radius-Skala). Build + 11er-E2E-Suite grün, zusätzlich manueller Light/Dark-Mode-Vergleich auf Login/Home/Admin im Browser (inkl. Test mit OS-Preference=light + App-Theme=dark, um sicherzustellen dass die `.dark`-Klasse und nicht nur die Media Query greift).
- [x] **Backend: 3× moderate Vulnerabilities** in der Prisma/@hono/node-server-Kette (GHSA-92pp-h63x-v22m) — erledigt (2026-07-06), ohne Downgrade. `prisma@7.8.0` pinnt `@prisma/dev@0.24.3` (verwundbar, `@hono/node-server@1.19.11`). Ab `@prisma/dev@0.24.9` ist `@hono/node-server` bereits auf `^1.19.14` gepatcht. Fix per `overrides`-Eintrag in `backend/package.json` (`"@prisma/dev": "^0.24.14"`), ohne `prisma` selbst zu verändern. `npm audit`: 0 Vulnerabilities. 103 Backend-Tests + 11 E2E-Tests grün.

Details und Entscheidungshistorie: siehe lokale Notizen zum wöchentlichen Security-/Dependency-Scan (nicht Teil dieses Repos).

## Feature-Ideen (für später, noch nicht angefangen)

- [ ] **Swipe-Navigation zur Ruhmeshalle** — per Links-/Rechts-Wischen (Touch-Geste) von der Home-Seite zur Hall-of-Fame-Seite wechseln können.
- [ ] **Mehrere Haushalte** — Große Änderung, Anforderungen noch nicht geschärft. Eckpunkte aus erstem Gespräch:
  - Getrennte Aufgaben und Statistiken pro Haushalt
  - Ein Nutzer kann Mitglied in mehreren Haushalten sein
  - Nutzer kann zwischen seinen Haushalten wechseln
  - Beitritt zu einem Haushalt nur per Einladung (kein offener Self-Signup pro Haushalt)
  - Vor Umsetzung: Anforderungen im Detail klären (u.a. Rollen/Rechte pro Haushalt, Einladungs-Mechanismus, Datenmodell-Migration für bestehende Nutzer/Aufgaben, Auswirkung auf Admin-Verwaltung, Ruhmeshalle und Push-Benachrichtigungen)
