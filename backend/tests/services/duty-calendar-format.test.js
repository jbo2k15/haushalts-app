import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ical from 'node-ical'
import { dutyFromEvent } from '../../src/services/duty-calendar.js'

// Prüft die Zuordnung gegen das echte Format des Hühnerstall-Kalenderabos
// (Aufbau 1:1 übernommen, Namen und Kennungen ersetzt) - hier bewusst mit dem
// echten node-ical-Parser statt nachgebauter Ereignis-Objekte.
const file = fileURLToPath(new URL('../fixtures/dienstplan-beispiel.ics', import.meta.url))
const events = Object.values(ical.sync.parseICS(readFileSync(file, 'utf8'))).filter(e => e.type === 'VEVENT')

describe('Dienstplan-Kalender: echtes Abo-Format', () => {
  it('liest alle Einzeltermine', () => {
    expect(events).toHaveLength(3)
  })

  it('macht aus den Terminen Aufgaben mit Berliner Datum, Termin-UID und Erledigt-Status, ohne Emojis', () => {
    const duties = events.map(e => dutyFromEvent(e, { label: 'Hühner' }))
    expect(duties).toEqual([
      { title: 'Hühner: Futter runterlassen', dueDate: '2026-12-01', minutes: 540, timeOfDay: 'morning', uid: '0000000000000000000000000000000000000000000000000000000000000001@example.org', done: true },
      { title: 'Hühner: Futter hochziehen', dueDate: '2026-12-01', minutes: 1020, timeOfDay: 'evening', uid: '0000000000000000000000000000000000000000000000000000000000000002@example.org', done: false },
      // Sommerzeit: 07:00Z ist 09:00 Uhr in Berlin
      // ohne X-HUHN-ERLEDIGT: Status unbekannt
      { title: 'Hühner: Futter runterlassen', dueDate: '2027-07-04', minutes: 540, timeOfDay: 'morning', uid: '0000000000000000000000000000000000000000000000000000000000000003@example.org', done: null },
    ])
  })

  it('findet den Filtertext in der Beschreibung', () => {
    expect(dutyFromEvent(events[0], { filter: 'muster' })).not.toBeNull()
    expect(dutyFromEvent(events[0], { filter: 'andere' })).toBeNull()
  })
})
