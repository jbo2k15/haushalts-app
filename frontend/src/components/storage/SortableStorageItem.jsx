import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import StorageItemRow from './StorageItemRow.jsx'

// Dünner dnd-kit-Wrapper um StorageItemRow - useSortable() darf nur innerhalb
// eines SortableContext aufgerufen werden, daher als eigene Komponente statt
// bedingt in StorageItemRow selbst (siehe CategoryGroup: im Auffüll-
// Sortiermodus wird StorageItemRow ohne diesen Wrapper direkt gerendert).
export default function SortableStorageItem({ item, defaultMinQuantity, onChanged, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <StorageItemRow
      item={item}
      defaultMinQuantity={defaultMinQuantity}
      onChanged={onChanged}
      onEdit={onEdit}
      dragHandleProps={{ ...attributes, ...listeners }}
      setNodeRef={setNodeRef}
      style={style}
    />
  )
}
