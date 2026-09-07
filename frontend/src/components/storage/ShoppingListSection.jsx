import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'

// Einkaufsliste (TODO.md "Vorratsschrank-Verwaltung"): Artikel bei/unter der
// Mindestmenge, über alle Lagerorte hinweg - bewusst kein Task/Aufgabe,
// eigene Sektion oben auf der Vorrat-Seite. Abhaken hebt die Menge auf die
// Mindestmenge an (statt sie zu löschen) - der Artikel bleibt Teil des
// Bestands, ist nur nicht mehr knapp.
export default function ShoppingListSection({ refreshKey, onChanged }) {
  const [items, setItems] = useState(null)

  async function load() {
    setItems(await api.get('/storage/low-stock'))
  }

  useEffect(() => { load() }, [refreshKey])

  async function handleCheck(item) {
    // +1, nicht genau minQuantity: die Ampel-Logik zählt "quantity <=
    // minQuantity" weiterhin als "niedrig" (Reorder-Point-Semantik, siehe
    // StorageItemRow) - exakt auf die Mindestmenge zu heben würde den
    // Artikel sonst nicht aus der Einkaufsliste entlassen.
    await api.patch(`/storage/items/${item.id}/quantity`, { quantity: item.minQuantity + 1 })
    await load()
    await onChanged()
  }

  if (!items || items.length === 0) return null

  return (
    <Card className="overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-surface-container-high border-b border-outline flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide flex-1">Einkaufsliste</span>
        <Badge tone="warning">{items.length} knapp</Badge>
      </div>
      {items.map(item => (
        <div key={item.id} data-testid="shopping-list-row" data-item-name={item.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline last:border-b-0">
          <button
            onClick={() => handleCheck(item)}
            aria-label={`${item.name} als eingekauft markieren`}
            className="w-5 h-5 rounded shrink-0 border-2 border-outline-strong hover:bg-surface-container-high"
          />
          <span className="flex-1 text-sm text-ink truncate">{item.name}</span>
          <span className="text-xs text-ink-faint shrink-0">{item.locationName}</span>
        </div>
      ))}
    </Card>
  )
}
