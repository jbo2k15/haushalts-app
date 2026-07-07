# Offene Aufgaben

## Sicherheit / Wartung

- [ ] **Deprecation-Warnung `inlineDynamicImports` von `vite-plugin-pwa`** (frontend) — seit Vite 8 setzt `vite-plugin-pwa@1.3.0` (aktuellste Version) beim internen Service-Worker-Build noch die alte Rollup-Option `output.inlineDynamicImports: true` statt Vites neuer `build.codeSplitting: false`. Hartcodiert im Plugin, nicht über unsere `vite.config.js` überschreibbar. Nur eine Warnung, keine Fehlfunktion. Beheben, sobald `vite-plugin-pwa` ein Vite-8-Kompatibilitäts-Release bringt — Changelog bei nächstem Scan prüfen.

## Feature-Ideen (für später, noch nicht angefangen)

- [ ] **Mehrere Haushalte** — Große Änderung, Anforderungen noch nicht geschärft. Eckpunkte aus erstem Gespräch:
  - Getrennte Aufgaben und Statistiken pro Haushalt
  - Ein Nutzer kann Mitglied in mehreren Haushalten sein
  - Nutzer kann zwischen seinen Haushalten wechseln
  - Beitritt zu einem Haushalt nur per Einladung (kein offener Self-Signup pro Haushalt)
  - Vor Umsetzung: Anforderungen im Detail klären (u.a. Rollen/Rechte pro Haushalt, Einladungs-Mechanismus, Datenmodell-Migration für bestehende Nutzer/Aufgaben, Auswirkung auf Admin-Verwaltung, Ruhmeshalle und Push-Benachrichtigungen)

---

## Erledigt (Archiv)

- ✅ Swipe-Navigation zwischen Home und Ruhmeshalle (v1.8.0, 2026-07-07)
- ✅ VAPID-Schlüsselpaar rotiert nach GitGuardian-Meldung (2026-07-07) — Details: Commit "Security: geleakten VAPID-Schluessel aus Test-Configs entfernen"
- ✅ Server-Resync nach Git-History-Rewrite (2026-07-07)
- ✅ Push-Subscriptions erkennen jetzt Ungültigkeit nach VAPID-Rotation (2026-07-07)
- ✅ Major-Updates `vite` 7→8, `@vitejs/plugin-react` 4→6, `react-router` 7→8, `tailwindcss` 3→4 (2026-07-06)
- ✅ Backend-Vulnerability in Prisma/@hono/node-server-Kette gefixt ohne Downgrade (2026-07-06)

Details und Entscheidungshistorie zu Scans: siehe lokale Notizen zum wöchentlichen Security-/Dependency-Scan (nicht Teil dieses Repos). Für alles andere: Git-Log.
