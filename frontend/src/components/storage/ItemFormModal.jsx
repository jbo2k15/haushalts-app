import { useState } from 'react'
import { api } from '../../api/client.js'
import Button from '../ui/Button.jsx'

// Anlegen/Bearbeiten eines Artikels. Kategorie-Wechsel ist möglich (siehe
// TODO.md), aber nur innerhalb desselben Lagerorts - ein Wechsel des
// Lagerorts selbst geht bewusst nur über Löschen+Neuanlegen.
export default function ItemFormModal({ categoryId, item, autocomplete, locations, onClose, onSaved }) {
  const startCategoryId = item?.categoryId ?? categoryId
  const location = locations.find(l => l.categories.some(c => c.id === startCategoryId))

  const [name, setName] = useState(item?.name ?? '')
  const [selectedCategoryId, setSelectedCategoryId] = useState(startCategoryId)
  const [quantity, setQuantity] = useState(item?.quantity ?? 0)
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [minQuantity, setMinQuantity] = useState(item?.minQuantity ?? '')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    const payload = {
      name: name.trim(),
      quantity: Number(quantity) || 0,
      unit: unit.trim() || null,
      minQuantity: minQuantity === '' ? null : Number(minQuantity),
    }
    try {
      if (item) {
        await api.put(`/storage/items/${item.id}`, { ...payload, categoryId: selectedCategoryId })
      } else {
        await api.post(`/storage/categories/${selectedCategoryId}/items`, payload)
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  const category = location?.categories.find(c => c.id === selectedCategoryId)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-surface-container rounded-modal w-full max-w-sm p-4 space-y-3"
        role="dialog"
        aria-modal="true"
        aria-label={item ? 'Artikel bearbeiten' : 'Artikel anlegen'}
      >
        <h2 className="text-sm font-semibold text-ink">{item ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div>
          <label htmlFor="item-name" className="text-xs text-ink-muted">Name</label>
          <input
            id="item-name" autoFocus value={name} onChange={e => setName(e.target.value)}
            list="storage-item-names"
            className="w-full mt-0.5 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
          />
          <datalist id="storage-item-names">
            {autocomplete.itemNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>

        {location && (
          <div>
            <label htmlFor="item-category" className="text-xs text-ink-muted">Kategorie</label>
            <select
              id="item-category" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}
              className="w-full mt-0.5 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
            >
              {location.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="item-quantity" className="text-xs text-ink-muted">Menge</label>
            <input
              id="item-quantity" type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="w-full mt-0.5 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="item-unit" className="text-xs text-ink-muted">Einheit</label>
            <input
              id="item-unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="z.B. Dosen"
              className="w-full mt-0.5 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
            />
          </div>
        </div>

        <div>
          <label htmlFor="item-min-quantity" className="text-xs text-ink-muted">
            Mindestmenge {category ? `(Kategorie-Default: ${category.defaultMinQuantity})` : ''}
          </label>
          <input
            id="item-min-quantity" type="number" min="0" value={minQuantity} onChange={e => setMinQuantity(e.target.value)}
            placeholder="leer = Kategorie-Default nutzen"
            className="w-full mt-0.5 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" className="flex-1">Speichern</Button>
        </div>
      </form>
    </div>
  )
}
