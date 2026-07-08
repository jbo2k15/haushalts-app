# Offene Aufgaben

## Sicherheit / Wartung

- [ ] **Deprecation-Warnung `inlineDynamicImports` von `vite-plugin-pwa`** (frontend) — seit Vite 8 setzt `vite-plugin-pwa@1.3.0` (aktuellste Version) beim internen Service-Worker-Build noch die alte Rollup-Option `output.inlineDynamicImports: true` statt Vites neuer `build.codeSplitting: false`. Hartcodiert im Plugin, nicht über unsere `vite.config.js` überschreibbar. Nur eine Warnung, keine Fehlfunktion. Beheben, sobald `vite-plugin-pwa` ein Vite-8-Kompatibilitäts-Release bringt — Changelog bei nächstem Scan prüfen.
- [ ] **`npm ci`-Deprecation-Warnungen beim Docker-Build** (2026-07-07 beim Deploy aufgefallen) — `source-map@0.8.0-beta.0` + `glob@11.1.0` kommen aus `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` (beide aktuellste Version, gehört zur selben "wartet auf Upstream"-Situation wie oben). `prebuild-install@7.1.3` kommt aus `better-sqlite3@12.11.1` (ebenfalls aktuellste Version). Reines Warnrauschen tief in der Kette, kein `npm audit`-Finding, nicht behebbar ohne Upstream-Release — bei künftigen Scans nur prüfen, ob eine neuere Version verfügbar ist.

## Bugs (für später)

- [ ] **Browser-Reload springt zurück auf die Ruhmeshalle** — Reproduktion: von Home zur Ruhmeshalle wischen, wieder zurück zu Home wischen, dann die Seite manuell neu laden (F5/Reload) — statt auf Home zu bleiben, landet man wieder auf der Ruhmeshalle. Vermutung: `navigate(path, { replace: true })` in `PageCarousel.jsx` aktualisiert die URL evtl. nicht zuverlässig genug für einen echten Browser-Reload (Unterschied zwischen sichtbarem Inhalt und tatsächlicher Adresszeile/History-Eintrag), oder der Service Worker liefert für den Reload eine gecachte, veraltete Route aus. Noch nicht untersucht.
- [ ] **Release-Notes-Modal erscheint vor dem Versions-Update im Footer** — Nach einem Deploy zeigt die App beim nächsten Start bereits das "Was ist neu"-Modal für die neue Version, aber die Versionsnummer im Footer bleibt auf dem alten Stand, bis die App komplett geschlossen und neu geöffnet wird (typisches PWA-/Service-Worker-Update-Timing: der neue Service Worker samt neuem `__APP_VERSION__` übernimmt erst nach vollständigem Neustart, während der Release-Notes-Fetch vom Server bereits die neue Version kennt). Ziel: Modal soll erst erscheinen, wenn die App tatsächlich auf der neuen Version läuft (Footer und Modal synchron). Noch nicht untersucht — vermutlich muss der Service-Worker-Update-Lifecycle (`skipWaiting`/`controllerchange`) mit der Anzeige des Modals verknüpft werden.

## Feature-Ideen (für später, noch nicht angefangen)

- [ ] **Navigation überdenken: "← Zurück"-Button in der Ruhmeshalle vs. Menü-Eintrag** — Seit es die Wisch-Navigation gibt, stellt sich die Frage, ob der "← Zurück"-Button in der Ruhmeshalle noch gebraucht wird (man kann ja zurückwischen). Alternative Idee: stattdessen einen festen Menü-Eintrag ergänzen, der direkt zur aktuellen Aufgabenübersicht (Home) springt — dann gäbe es nur zwei konstante Navigationswege: Wischen und das Menü. Noch nicht entschieden, erst UX-Abwägung nötig (u.a.: brauchen andere Seiten wie Settings/Admin dann auch einen "Home"-Menüpunkt statt eigenem Zurück-Button, für Konsistenz?).
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
