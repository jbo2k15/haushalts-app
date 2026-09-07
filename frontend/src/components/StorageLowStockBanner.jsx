import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'

// Kleiner Hinweis auf der Startseite, wenn im Vorrat etwas knapp ist (TODO.md
// "Vorratsschrank-Verwaltung") - hält Home aufgabenfokussiert, macht den
// Vorrat-Tab aber trotzdem sichtbar, ohne aktiv dorthin wechseln zu müssen.
export default function StorageLowStockBanner() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)

  useEffect(() => {
    api.get('/storage/low-stock').then(items => setCount(items.length)).catch(() => {})
  }, [])

  if (count === 0) return null

  return (
    <button
      onClick={() => navigate('/storage')}
      className="w-full flex items-center gap-2 bg-warning-container text-on-warning-container rounded-card px-4 py-2.5 mb-2 text-sm"
    >
      <span className="flex-1 text-left">{count === 1 ? '1 Artikel im Vorrat ist knapp' : `${count} Artikel im Vorrat sind knapp`}</span>
      <span aria-hidden="true">›</span>
    </button>
  )
}
