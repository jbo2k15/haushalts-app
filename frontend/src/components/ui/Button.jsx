import { forwardRef } from 'react'

// Basis-Button (Redesign, Phase 0). Vereinheitlicht die bisher pro Stelle
// kopierten Button-Klassen. Varianten mappen auf die semantischen Tokens
// aus index.css. forwardRef, damit z. B. ConfirmDialog den Button fokussieren
// kann.
const VARIANTS = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-transparent text-ink border border-outline-strong hover:bg-surface-container-high',
  ghost: 'bg-transparent text-ink hover:bg-surface-container-high',
  danger: 'bg-danger text-on-danger',
}

const SIZES = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
}

const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`rounded-control font-medium transition-colors disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
})

export default Button
