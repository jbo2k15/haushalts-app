# Offene Aufgaben

## Aus wöchentlichem Security-/Dependency-Scan (2026-07-06)

- [ ] **Major-Update `vite` 7 → 8** (frontend) — BLOCKIERT (2026-07-06): `npm install vite@8 @vitejs/plugin-react@6` scheitert mit ERESOLVE-Konflikt. `@vitejs/plugin-react@6.0.3` hat eine optionale Peer-Abhängigkeit zu `@rolldown/plugin-babel`, die `@babel/core@^8.0.0-rc.1` verlangt, während `vite-plugin-pwa`/`workbox-build` an `@babel/core@7.29.7` hängen. Kein sauberer Install ohne `--legacy-peer-deps`/`--force` möglich — bewusst nicht erzwungen. Erneut versuchen, sobald das Rolldown/Babel-Ökosystem sich stabilisiert hat (npm-Registry erneut prüfen).
- [ ] **Major-Update `@vitejs/plugin-react` 4 → 6** (frontend) — siehe oben, gleicher Blocker, muss zusammen mit vite gelöst werden.
- [ ] **Major-Update `react-router` 7 → 8** (frontend) — Breaking Changes in Routing-API prüfen, betrifft App.jsx/Routen.
- [ ] **Major-Update `tailwindcss` 3 → 4** (frontend) — Config-Migration nötig (neue v4-Config-Syntax), danach visuelle Regression in allen Views prüfen.
- [ ] **Backend: 3× moderate Vulnerabilities** in der Prisma/@hono/node-server-Kette (GHSA-92pp-h63x-v22m) — betrifft nur Dev-Toolchain, kein Produktionsrisiko. Bei nächstem Scan erneut prüfen, ob ein Fix ohne Breaking Change verfügbar ist.

Details und Entscheidungshistorie: `(lokale Notizen zum woechentlichen Security-Dependency-Scan, nicht Teil dieses Repos)`
