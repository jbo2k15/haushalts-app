// Vorratsmengen sind Kommazahlen (z. B. 1,5 kg Mehl). Eingabe als Text mit
// inputMode="decimal", damit Komma UND Punkt in allen Browsern funktionieren
// (type="number" verwirft "1,5" je nach Browser/Sprache stillschweigend).

const formatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

// 1.5 -> "1,5", 3 -> "3"
export function formatQuantity(value) {
  return value == null || value === '' ? '' : formatter.format(Number(value))
}

// "1,5" / "1.5" / " 2 " -> Zahl; leer -> null; ungueltig -> NaN
export function parseQuantity(text) {
  const s = String(text ?? '').trim().replace(',', '.')
  if (s === '') return null
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

// Eingabewert fuer ein Formularfeld: 1.5 -> "1,5"
export function quantityInputValue(value) {
  return value == null ? '' : formatQuantity(value).replace(/\./g, '')
}
