// Basis-Badge (Redesign, Phase 0). Vereinheitlicht die kleinen farbigen Pills
// (Kategorie, Status). Töne mappen auf die Container-Tokens aus index.css.
//   category  -> Sekundärfarbe (z. B. "mehrfach")
//   primary   -> Marken-Container (z. B. "Wetter", "Abfall")
//   success/warning/danger -> semantische Status ("aktiv", "wartet", ...)
const TONES = {
  neutral: 'bg-surface-container-high text-ink-muted',
  primary: 'bg-primary-container text-on-primary-container',
  category: 'bg-secondary-container text-on-secondary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  danger: 'bg-danger-container text-on-danger-container',
}

export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
