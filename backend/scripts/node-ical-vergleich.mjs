// Vergleicht den echten Abfallkalender-Feed (WASTE_ICAL_URL) mit der
// installierten node-ical-Version und einer neuen Version aus /tmp/ical-new.
// Laeuft im Backend-Container, aendert nichts an der App oder Datenbank.
// Ausgabe: nur Termine (Datum + Tonnenart), keine anderen Daten.
//
// Aufruf auf dem Server (Version anpassen, z. B. 0.27 = neueste 0.27.x):
//   cd /opt/haushalts-app
//   docker compose exec -T -e npm_config_cache=/tmp/npm-cache backend \
//     npm install --no-save --no-audit --no-fund --prefix /tmp/ical-new node-ical@0.27
//   docker compose exec -T backend sh -c 'cat > /tmp/vergleich.mjs' < backend/scripts/node-ical-vergleich.mjs
//   docker compose exec -T backend node /tmp/vergleich.mjs
// Alles liegt nur in /tmp des Containers (tmpfs) und ist nach einem Neustart weg.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const url = process.env.WASTE_ICAL_URL
if (!url) { console.error('WASTE_ICAL_URL ist nicht gesetzt'); process.exit(1) }

const require = createRequire(import.meta.url)
const oldDir = '/app/node_modules/node-ical'
const newDir = '/tmp/ical-new/node_modules/node-ical'
const version = dir => JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')).version

async function load(dir) {
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))
  try {
    const mod = await import(`${dir}/${pkg.exports?.['.']?.import?.default?.replace('./', '') || pkg.main || 'node-ical.js'}`)
    return mod.default || mod
  } catch {
    return require(dir)
  }
}

// Identisch zu backend/src/services/waste-calendar.js
function toDateString(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extract(events) {
  const rows = []
  let recurring = 0
  for (const ev of Object.values(events)) {
    if (ev.type !== 'VEVENT') continue
    if (ev.rrule) recurring++
    const summary = typeof ev.summary === 'object' ? ev.summary?.val : ev.summary || ''
    rows.push(`${toDateString(ev.start)} ${summary.trim()}`)
  }
  return { rows: rows.sort(), recurring }
}

const res = await fetch(url)
if (!res.ok) { console.error(`Feed-Abruf fehlgeschlagen: HTTP ${res.status}`); process.exit(1) }
const text = await res.text()

const oldIcal = await load(oldDir)
const newIcal = await load(newDir)
const a = extract(oldIcal.sync.parseICS(text))
const b = extract(newIcal.sync.parseICS(text))

console.log(`node-ical alt: ${version(oldDir)}  |  neu: ${version(newDir)}`)
console.log(`Termine im Feed: alt ${a.rows.length}, neu ${b.rows.length}  |  davon wiederkehrend (RRULE): alt ${a.recurring}, neu ${b.recurring}`)

const onlyOld = a.rows.filter(r => !b.rows.includes(r))
const onlyNew = b.rows.filter(r => !a.rows.includes(r))
if (onlyOld.length === 0 && onlyNew.length === 0) {
  console.log('ERGEBNIS: identisch - alle Termine mit gleichem Datum. Update ist unbedenklich.')
} else {
  console.log('ERGEBNIS: UNTERSCHIEDE gefunden:')
  for (const r of onlyOld) console.log(`  nur ALT: ${r}`)
  for (const r of onlyNew) console.log(`  nur NEU: ${r}`)
}
const today = toDateString(new Date())
console.log('Naechste Termine (neu):')
for (const r of b.rows.filter(r => r >= today).slice(0, 6)) console.log(`  ${r}`)
