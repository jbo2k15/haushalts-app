# Sicherheitsrichtlinie

## Unterstützte Versionen

Die Haushalts-App ist ein privates, selbst gehostetes Projekt. Sicherheitskorrekturen
gibt es nur für den aktuellen Stand des `main`-Branches bzw. das jeweils neueste Release.

| Version            | Unterstützt |
| ------------------ | ----------- |
| neuestes Release   | ✅          |
| ältere Releases    | ❌          |

## Sicherheitslücke melden

Bitte melde Sicherheitslücken **nicht** über öffentliche Issues, Pull Requests oder Diskussionen.

Nutze stattdessen die private Meldefunktion von GitHub:
[Security → Report a vulnerability](https://github.com/jbo2k15/haushalts-app/security/advisories/new)

Hilfreich sind:

- betroffene Komponente (Backend, Frontend, Deployment) und Version bzw. Commit
- Beschreibung der Lücke und mögliche Auswirkungen
- Schritte zur Reproduktion oder ein Proof of Concept

## Ablauf

- Eingangsbestätigung in der Regel innerhalb von 7 Tagen
- Bewertung und, falls bestätigt, Fix im nächsten Release
- Veröffentlichung eines Security Advisorys nach dem Fix; auf Wunsch mit Nennung der meldenden Person

Da es sich um ein Ein-Personen-Projekt handelt, gibt es kein Bug-Bounty-Programm.

## Bitte beachten

- Keine Tests gegen die produktive Instanz, die Last erzeugen oder Daten verändern
  (kein DoS, kein Brute-Force, kein Zugriff auf fremde Daten).
- Gefundene Daten vertraulich behandeln und nicht weitergeben.

---

*English:* Please report security issues privately via
[GitHub's vulnerability reporting](https://github.com/jbo2k15/haushalts-app/security/advisories/new),
not via public issues. Only the latest release is supported.
