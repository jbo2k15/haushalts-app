const RULES = [
  { label: 'Mindestens 10 Zeichen', test: pw => pw.length >= 10 },
  { label: 'Großbuchstabe (A–Z)', test: pw => /[A-Z]/.test(pw) },
  { label: 'Kleinbuchstabe (a–z)', test: pw => /[a-z]/.test(pw) },
  { label: 'Zahl (0–9)', test: pw => /[0-9]/.test(pw) },
  { label: 'Sonderzeichen (!@#…)', test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export function validatePassword(pw) {
  return RULES.every(r => r.test(pw))
}

export default function PasswordStrength({ password }) {
  if (!password) return null
  return (
    <ul className="mt-2 space-y-1">
      {RULES.map(({ label, test }) => {
        const ok = test(password)
        return (
          <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            <span className="flex-shrink-0">{ok ? '✓' : '○'}</span>
            {label}
          </li>
        )
      })}
    </ul>
  )
}
