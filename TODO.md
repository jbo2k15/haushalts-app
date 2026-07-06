# Offene Aufgaben

## Aus wöchentlichem Security-/Dependency-Scan (2026-07-06)

- [ ] **Major-Update `vite` 7 → 8** (frontend) — Breaking Changes prüfen, danach Build + volle E2E-Suite laufen lassen.
- [ ] **Major-Update `@vitejs/plugin-react` 4 → 6** (frontend) — vermutlich zusammen mit vite-Update, da eng gekoppelt.
- [ ] **Major-Update `react-router` 7 → 8** (frontend) — Breaking Changes in Routing-API prüfen, betrifft App.jsx/Routen.
- [ ] **Major-Update `tailwindcss` 3 → 4** (frontend) — Config-Migration nötig (neue v4-Config-Syntax), danach visuelle Regression in allen Views prüfen.
- [ ] **Backend: 3× moderate Vulnerabilities** in der Prisma/@hono/node-server-Kette (GHSA-92pp-h63x-v22m) — betrifft nur Dev-Toolchain, kein Produktionsrisiko. Bei nächstem Scan erneut prüfen, ob ein Fix ohne Breaking Change verfügbar ist.

Details und Entscheidungshistorie: `(lokale Notizen zum woechentlichen Security-Dependency-Scan, nicht Teil dieses Repos)`
