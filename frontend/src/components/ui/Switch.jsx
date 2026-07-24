// Basis-Toggle (Redesign, Phase 0). Ersetzt in Phase 1 die vier inline
// kopierten Toggle-Buttons in Settings.jsx. Bringt gegenüber diesen zusätzlich
// die korrekte ARIA-Semantik mit (role="switch" + aria-checked).
export default function Switch({ checked, onChange, className = '', ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-outline-strong'} ${className}`}
      {...props}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}
