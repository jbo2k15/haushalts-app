// Basis-Karte (Redesign, Phase 0). Ersetzt in Phase 1 die wiederholten
// `bg-white dark:bg-gray-800 rounded-2xl border ...`-Kombinationen durch die
// semantischen Surface-/Outline-Tokens aus index.css.
export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-surface-container rounded-card border border-outline ${className}`} {...props}>
      {children}
    </div>
  )
}
