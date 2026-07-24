import { useEffect, useState } from 'react'
import { MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { api } from '../api/client.js'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import { useDialog } from '../context/DialogContext.jsx'
import TaskFormFields from '../components/admin/TaskFormFields.jsx'
import TasksTab from '../components/admin/TasksTab.jsx'
import Button from '../components/ui/Button.jsx'
import { EMPTY_FORM } from '../components/admin/constants.js'

// Verwaltung: seit dem IA-Umbau (siehe REDESIGN.md) ausschließlich
// Aufgabenverwaltung. Die Nutzerverwaltung ist als admin-only Abschnitt in
// die Einstellungen umgezogen (Settings.jsx).
export default function Admin() {
  const dialog = useDialog()
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    // Tastatur-Zugänglichkeit fürs Sortieren (Leertaste aufnehmen, Pfeile
    // bewegen, Leertaste ablegen) — vorher nur Maus/Touch.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function closeEditModal() {
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  useBodyScrollLock(!!editId)

  useEffect(() => {
    if (!editId) return
    function handleKeyDown(event) {
      if (event.key === 'Escape') closeEditModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    // TaskFormFields renders the title input with a fixed id - focusing it
    // by id avoids threading a ref through that shared component just for
    // this one caller.
    document.getElementById('task-title')?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editId])

  async function loadTasks() {
    try {
      const data = await api.get('/tasks/admin')
      setTasks(data)
    } catch {}
  }

  useEffect(() => { loadTasks() }, [])

  async function handleExport() {
    const data = await api.get('/tasks/admin/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aufgaben.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    let data
    try { data = JSON.parse(text) } catch { dialog.alert('Ungültige JSON-Datei'); return }
    const result = await api.post('/tasks/admin/import', data)
    dialog.alert(result.message)
    loadTasks()
    e.target.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      ...form,
      weekdays: form.type === 'daily' ? form.weekdays : [],
      fixedWeekday: form.type === 'weekly' && form.fixedWeekday !== '' ? Number(form.fixedWeekday) : null,
      fixedDayOfMonth: form.type === 'monthly' && form.fixedDayOfMonth !== '' ? Number(form.fixedDayOfMonth) : null,
      dueDate: form.type === 'once' ? form.dueDate : null,
      allowMultiple: (form.type === 'daily' || form.type === 'weekly') && form.allowMultiple,
      weatherDependent: form.type === 'daily' && form.weatherDependent,
      pauseFrom: form.type !== 'once' && form.pauseFrom ? form.pauseFrom : null,
      pauseTo: form.type !== 'once' && form.pauseTo ? form.pauseTo : null,
    }
    try {
      if (editId) {
        await api.put(`/tasks/admin/${editId}`, payload)
      } else {
        await api.post('/tasks/admin', payload)
      }
      setForm(EMPTY_FORM)
      setEditId(null)
      setShowForm(false)
      loadTasks()
    } catch (err) {
      dialog.alert(err.message)
    }
  }

  function startEdit(task) {
    setForm({
      title: task.title,
      type: task.type,
      priority: task.priority,
      weekdays: task.weekdays || [],
      fixedWeekday: task.fixedWeekday ?? '',
      fixedDayOfMonth: task.fixedDayOfMonth ?? '',
      dueDate: task.dueDate || '',
      isActive: task.isActive,
      allowMultiple: task.allowMultiple || false,
      weatherDependent: task.weatherDependent || false,
      pauseFrom: task.pauseFrom || '',
      pauseTo: task.pauseTo || '',
    })
    setEditId(task.id)
    setShowForm(false)
  }

  async function deleteTask(id) {
    if (!(await dialog.confirm({ title: 'Aufgabe löschen?', message: 'Aufgabe wirklich löschen?', confirmLabel: 'Löschen', tone: 'danger' }))) return
    try {
      await api.delete(`/tasks/admin/${id}`)
      loadTasks()
    } catch (err) {
      dialog.alert(err.message)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    setTasks(reordered)
    await api.post('/tasks/admin/reorder', { orderedIds: reordered.map(t => t.id) })
  }

  const wasteTasks = tasks
    .filter(t => t.isAutoGenerated)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

  return (
    <div className="min-h-screen bg-surface">
      {editId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
          <form
            onSubmit={handleSubmit}
            className="bg-surface-container rounded-modal w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-heading"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 id="edit-task-heading" className="text-sm font-semibold text-ink">Aufgabe bearbeiten</h2>
              <button type="button" onClick={closeEditModal} aria-label="Schließen" className="shrink-0 w-11 h-11 -my-2 -mr-2 flex items-center justify-center text-ink-faint hover:text-ink text-lg leading-none">✕</button>
            </div>
            <TaskFormFields form={form} setForm={setForm} />
            <Button type="submit" variant="primary" className="w-full">Speichern</Button>
          </form>
        </div>
      )}
      {/* inert while the edit modal is up - traps focus/pointer interaction
          inside the modal instead of letting Tab or a stray tap reach the
          page underneath. */}
      <div className="max-w-lg mx-auto px-4 pb-24" inert={!!editId}>
        <header className="py-4">
          <h1 className="text-xl font-semibold text-ink">Verwaltung</h1>
          <p className="text-xs text-ink-faint mt-0.5">Aufgaben des Haushalts</p>
        </header>

        <main>
          <TasksTab
            tasks={tasks}
            wasteTasks={wasteTasks}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            showForm={showForm}
            onToggleForm={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(s => !s) }}
            onExport={handleExport}
            onImport={handleImport}
            onSubmit={handleSubmit}
            form={form}
            setForm={setForm}
            onEdit={startEdit}
            onDelete={deleteTask}
          />
        </main>
      </div>
    </div>
  )
}
