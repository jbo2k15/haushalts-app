# Redesign — Oberflächen-Modernisierung & Vereinheitlichung

Stand: 2026-07-24 · Referenzbasis: Version 1.12.2 · Status: **Planung, noch nichts umgesetzt**

Ziel: konsistentes, modernes Erscheinungsbild und einheitliche Bedienung. Entwurfsphase — dieser Plan wird schrittweise und überprüfbar umgesetzt, nicht als Big-Bang.

---

## Getroffene Entscheidungen

- **Design-Referenz:** Material Design 3 („Expressive"). Kein iOS im Einsatz → keine Abwägung gegen Apple-HIG-Nativität nötig, M3 ist saubere Wahl.
- **Umfang:** Große Überarbeitung, aber **bewusst entkoppelt** in einen risikoarmen Kern (Tokens, Komponenten, Dialoge — verhaltens- und testneutral) und die umstritteneren, testintensiveren Teile (Navigation, Palette).
- **Navigation:** Bottom-Navigation **vereint** mit dem bestehenden Wisch-Carousel. Alle Ziele werden Carousel-Slides; Wischen **und** Tippen bewegen sich durch dieselbe Seitenreihe, die Bottom-Nav zeigt die aktive Position und dient als Direkt-Shortcut. Die Bottom-Nav ist damit kein zweites Navigations-Paradigma, sondern Anzeige + Abkürzung über denselben Zustand.
- **Tab-Reihenfolge:** `Aufgaben · Ruhmeshalle · Verwaltung · Einstellungen`. „Aufgaben" ist der erste/Home-Tab. „Verwaltung" wird nur für Admins eingeblendet (Tab-Liste bleibt datengetrieben).
- **Inhalts-Aufteilung Verwaltung/Einstellungen:** „Verwaltung" enthält **nur noch die Aufgabenverwaltung** (Neue/Bearbeiten/Sortieren, Wetter-Status, „Alle pausieren", Abfallkalender, Export/Import); die internen Unter-Tabs (Aufgaben|Nutzer) entfallen. Die **Nutzerverwaltung** (Freischalten/Sperren, Rolle, Löschen) wandert als **admin-only Abschnitt in die Einstellungen** — selten genutzt, daher eine Ebene tiefer angemessen. **Kein 5. Tab.** Ergebnis: 4 Tabs, Aufteilung 3 (Nicht-Admin) / 4 (Admin).
  - Nicht jetzt angefasst: „Erinnerungszeiten" bleiben in den Einstellungen (für Nicht-Admins persönlich passend; der Admin-global-Aspekt ist ein separater Altbestand).
- **Zurück-Knopf-Modell:** Ist man **nicht** auf „Aufgaben", springt der Zurück-Pfeil zum Aufgaben-Tab. Ist man bereits dort, kommt die bestehende „App schließen?"-Abfrage. Ersetzt das heutige push/replace-Doppelmodell durch ein einfacheres, nativ-fühlendes.
- **Mount-Strategie:** Alle Slides immer gleichzeitig gemountet (wie heute die zwei Carousel-Seiten). Bei Haushaltsgröße (Dutzende Aufgaben, wenige Nutzer) unkritisch — Schwelle für spürbare Trägheit liegt bei ~200–400 Aufgaben in der Admin-Drag&Drop-Liste, also 1–2 Größenordnungen entfernt. Falls je nötig: aktiver+benachbarter Slide lazy mounten bzw. Admin-Liste virtualisieren (isolierter Nachrüst-Schritt, blockiert nichts).
- **Palette:** **B — Terrakotta/Clay** (warm, ruhiger als reines Orange). Sekundärfarbe für Kategorie-Badges: gedecktes Oliv/Lindgrün. Kontrast in Hell **und** Dunkel gegen WCAG 4.5:1 vor der finalen Anwendung prüfen. Wechsel zieht `theme_color`, App-Icons und Screenshots nach (bleibt nah an der bisherigen Marke, daher überschaubar).

---

## Befunde am Ist-Zustand

- **Kein Design-Token-System:** `index.css` enthält nur den Tailwind-Import + Basis-Reset, keinen `@theme`-Block. Farben/Radien/Schatten werden pro Komponente roh und einzeln geschrieben.
- **Messbare Drift:** `bg-orange-600` taucht ~40× wortgleich über 26 Dateien verteilt auf; `Home.jsx` nutzt an einer Stelle abweichend `bg-orange-500`. Genau das Symptom, das ein Token-System verhindert.
- **Radien uneinheitlich:** `rounded-xl` vs. `rounded-2xl` im Wechsel (100 Vorkommen) ohne erkennbare Regel.
- **Elevation kaum genutzt:** nur 3 Dateien verwenden überhaupt einen Schatten; Tiefe wird fast nur über 1px-Border simuliert.
- **Kategorie-Farben:** Abfall/Wetter/Multi-Erledigung sind alle in Orange-Tönen gehalten — keine sekundäre Farbe zur Unterscheidung.
- **Native Browser-Dialoge:** `confirm()`/`alert()` in `Admin.jsx` (Nutzer sperren/löschen, Rolle ändern) brechen visuell komplett aus dem System aus.

---

## Bausteine des Vorschlags

1. **Design-Tokens** via Tailwind v4 `@theme` in `index.css`: Farb-Rollen (`primary`, `primary-container`, `surface`, `surface-container`, `secondary`, `danger`, `success`, `warning`) je mit Light/Dark-Wert; 3-stufige Radius-Skala (Chips/Buttons klein, Karten mittel, Modals groß); 2 dezente Elevation-Stufen; Typo-Skala. Kleine Skala (M3 als Inspiration, nicht 1:1).
2. **Gemeinsame Basis-Komponenten** (Button-Varianten, Card, Badge, Switch) statt kopierter `className`-Strings.
3. **Tonale Karten / Elevation** über Oberflächenton statt reiner 1px-Trennlinie (Kontrast in beiden Modi prüfen — tonaler Look darf die Kartentrennung im Dunkelmodus nicht unter die Wahrnehmungsschwelle drücken).
4. **Unified Navigation** (Bottom-Nav + Carousel-Merge, siehe Entscheidungen).
5. **Eigene Bestätigungsdialoge** statt `confirm()`/`alert()` — im bestehenden Modal-System (inkl. der bereits vorhandenen Fokus-Falle/ARIA).
6. **Barrierefreiheit mitgezogen** (nicht als separater Durchlauf): Farbkontraste der Tokens gegen WCAG 4.5:1 geprüft; `Switch` mit `role="switch"`/`aria-checked`; je Screen semantische Landmarks (`<main>`/`<nav>`) statt `<div>`; globales `prefers-reduced-motion`-Handling; Skip-Link mit der Bottom-Nav. Deckt die offenen Punkte 3, 5–7 aus der Barrierefreiheits-Liste in TODO.md ab.

---

## Constraint: Multi-Tenancy nicht verbauen

Mehrere Haushalte sind **derzeit kein Ziel**, aber es soll keine Entscheidung getroffen werden, die es grundsätzlich verhindert. Die App ist heute single-tenant (ein geteilter Haushalt; `Task`/`User` haben keine Haushalts-Zugehörigkeit). Prinzip: **Tür offen halten, aber den Raum nicht bauen (YAGNI).**

Leitplanken für das Redesign (kosten jetzt nichts, größtenteils schon erfüllt):
1. Tab-/Navigationsliste **datengetrieben** halten, die vier Ziele nicht fest verdrahten (durch das Rollen-Gating ohnehin schon so).
2. **Keine** neuen globalen Singleton-Client-Stores, die „die eine Aufgabenliste" als systemweit annehmen — Daten weiter pro Nutzer/Kontext über die API laden.
3. In neuer UI-Copy nicht „alle Nutzer/alle Aufgaben" als Systemwahrheit einbrennen, wo „im Haushalt" gemeint ist.

Gegenwarnung: **nicht** spekulativ eine halbe Multi-Tenancy einbauen — eine halbfertige Abstraktion ist schlechter als keine. Multi-Tenancy wäre ein eigenes, großes Projekt (Haushalts-Entität + Scoping aller Queries + Beitritts-Flow + ggf. Wechsel von SQLite auf Postgres wegen dessen Single-Writer-Lock) und ist unabhängig vom Redesign.

---

## Fahrplan (schrittweise, risikoarm zuerst)

Reihenfolge bewusst so, dass verhaltens-/testneutrale Schritte zuerst kommen und der testintensive Navigations-Umbau zuletzt.

- **Phase 0 — Tokens + Basis-Komponenten. ✅ erledigt (2026-07-24).** Semantische Tokens (Palette B) in `index.css` via `@theme inline` + `.dark`-Umschaltung; Radius-Skala (`control`/`card`/`modal`) und zwei Elevation-Stufen. Basis-Komponenten unter `src/components/ui/`: `Button`, `Card`, `Badge`, `Switch` (noch nicht eingebunden, rein additiv). Build ok, Tokens im generierten CSS verifiziert, Backend 340/340 + E2E 53/53 grün.
- **Phase 1 — Screens visuell umstellen ✅ (2026-07-24).** Alle Screens auf Token-Klassen + Basis-Komponenten: Einstellungen, Verwaltung, Ruhmeshalle, Home und die Auth-Seiten (Login, Register, ForgotPassword, ResetPassword, ChangePassword + `PasswordStrength`). Auth-Seiten mit `<main>`-Landmark; ChangePassword-Hinweisbox nutzt das `info`-Token.
  - Verwaltung enthielt zugleich den **IA-Umbau**: Nutzerverwaltung → Einstellungen (admin-only Abschnitt), interne Unter-Tabs entfernt, `admin-user-management.spec.js` auf `/settings` umgestellt.
  - **Barrierefreiheit mitgezogen:** `prefers-reduced-motion` global in `index.css` ✅. `<header>`/`<main>`-Landmarks in Einstellungen, Verwaltung, Ruhmeshalle und Home ✅ (offen: Auth-Seiten). Neues `info`-Token (Blau) für „Wetter/automatisch"-Badges; alle Token-Kontraste (inkl. `info`) gegen WCAG 4.5:1 verifiziert.
  - Bewusst NICHT tokenisiert (eigene, universelle Bedeutung): Medaillenfarben (Bronze/Silber/Gold) in der Ruhmeshalle, Prioritäts-Randfarben in `TaskRow` (Violett/Grau), der grüne „erledigt"-Haken.
- **Phase 2 — Custom-Dialoge ✅ (2026-07-24).** Promise-basierter `DialogProvider`/`useDialog()` (`confirm`/`alert`) + `ConfirmDialog` (Token-Optik, Escape/Backdrop, Autofokus auf die sichere Aktion, Fokus-Falle via App-level `inert`). Ersetzt alle nativen `confirm()`/`alert()` (Aufgabe löschen, globale Pause beenden, Nutzer sperren/löschen/Rolle, Import-/Fehlermeldungen). 6 E2E-Specs von `page.on('dialog')` auf Klick des Dialog-Buttons umgestellt. E2E 53/53 grün.
- **Phase 3 — Navigation** (Bottom-Nav + Carousel-Merge, Zurück-Knopf-Modell). Bottom-Nav als `<nav>`-Landmark; „Zum Inhalt springen"-Skip-Link ergänzen. Größter E2E-Impact → zuletzt, mit Test-Anpassung.
- **Phase 4 — Palette final anwenden** (Kontraste bereits in Phase 0/1 verifiziert; ggf. Feinschliff am Bildschirm).

---

## Risiken / Testauswirkung

- Die 53 E2E-Tests hängen an `data-testid`, `data-slide-path`, der Carousel-Struktur und `getByRole('menuitem')`. Phase 0–2 sind weitgehend testneutral; **Phase 3 bricht bewusst mehrere E2E-Tests** (Navigations-Umbau) und erfordert deren Anpassung.
- Der bestehende Wisch-Carousel enthält hart erarbeitete Logik (Embla-`reInit()` bei Zoom-Änderung, History-Guard fürs Exit-Confirm). Beim Merge erhalten, nicht neu erfinden.

---

## Offene Entscheidungen

- **Palette — entschieden: B (Terrakotta/Clay).** (Verworfen: A Orange konsolidiert, C Indigo.)
- **Benennung** des neuen admin-only Abschnitts in den Einstellungen: **„Nutzerverwaltung"** (entschieden).

Alle Detailfragen entschieden → nächster Schritt ist **Phase 0** (Tokens + Basis-Komponenten).

---

## Phase 3 — Navigation: finale Entscheidungen (2026-07-24)

- Bottom-Nav + Carousel vereint; **Wischen nur zwischen Aufgaben ↔ Ruhmeshalle**, Verwaltung/Einstellungen nur per Tap.
- Header-Menü entfällt; **„Abmelden" wandert in die Einstellungen**.
- Icons: **`lucide-react`** (tree-shakeable) für die Bottom-Nav. Emojis bleiben selektiv erhalten (Medaillen 🥇🥈🥉, Gruß, Abschnitts-Header) — keine flächendeckende Ent-Emojisierung.
- Bottom-Nav immer sichtbar; Zurück-Knopf: nicht-Aufgaben → Aufgaben-Tab → „App schließen?".
- **Mit Phase 3 gebündelt:** SW-Update-Prompt (`registerType: 'prompt'` + „Neue Version"-Banner — behebt das stille Stale-App-Problem, HIGH-Finding); Embla `duration: 0` bei `prefers-reduced-motion`; `KeyboardSensor` fürs Admin-Drag&Drop; `<nav>`-Landmark + `aria-current` + „Zum Inhalt springen"-Skip-Link; Aufräumen der Token-Reste (PageCarousel-Dots/Tip, ExitConfirmModal, ReleaseNotesModal, ErrorBoundary).
- **Merge-Risiken** (aus Tech-Audit): `PAGES` wird rollengefiltert (Admin nur Admins → Länge 3 vs. 4) → Modulo-Index, `startIndex`-Ref und Re-Attach des `select`-Listeners nach `reInit()` müssen variable Länge verkraften; History-Exit-Guard + „Zurück → Aufgaben"-Modell sorgfältig sequenzieren. E2E-Aufwand: `swipe-carousel`, `header-menu`, `exit-confirm` + Navigationseinstiege in `hall-of-fame`/`settings`/`route-smoke`/`admin-*` anpassen.

## Engineering-/NFR-/Security-Backlog (Audit 2026-07-24)

**Umzusetzen (eigene Schritte, nicht Teil von Phase 3):**
- **CI** (GitHub Actions, Vitest + Playwright, Trigger push+PR auf `main`) — angelegt in `.github/workflows/ci.yml`. **Deploy an grünen CI-Lauf koppeln** — Mechanismus noch festzulegen.
- **SQLite `PRAGMA journal_mode=WAL; busy_timeout=5000`** — beugt „database is locked" beim Mehr-Seiten-Burst vor.
- **Screenshots** aus SW-Precache nehmen **und** nach Phase 4 neu aufnehmen (zeigen noch Orange).
- **axe/Lighthouse-Audit** vor dem Palette-Finale (Phase 4).
- **L1 Per-Account-Lockout** — später (verbessert Sicherheit + Haushalts-UX).
- **L2 Push-Endpoint-Reassignment** — **zu klären**: widerspricht der bewussten Entscheidung vom 2026-07-14 (Übernahme erlaubt + geloggt, für Besitzerwechsel auf geteiltem Gerät).

**Bewusst akzeptiert:**
- **M1 CSP `'unsafe-inline'` (styles)** — Fix bräche Emblas dynamische Inline-Transforms + Zoom/Rand-Styles; praktisches Risiko minimal (`script-src` fest auf `'self'`, keine Injektions-Sinks).
- **L3 `/api/health` unauth** — aktiv von Deploy-Smoke-Test + Monitoring genutzt, Info-Leak minimal.
- **L4 Reset-Token in URL** (Standard, entschärft), **L5 CORS-Fallback** (nur Nicht-Prod, in Prod fatal abgesichert).

## Recherche-Quellen (2025–2026)

- m3.material.io/foundations/design-tokens
- m3.material.io/styles/color/roles
- m3.material.io/styles/shape/corner-radius-scale
- supercharge.design/blog/material-3-expressive
- nicolalazzari.ai/articles/integrating-design-tokens-with-tailwind-css
- almanac.httparchive.org/en/2025/accessibility
- appstory.org/blog/7-pwa-trends-that-will-define-mobile-and-web-development-in-2026
