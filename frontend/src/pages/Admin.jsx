import { useEffect, useState } from 'react'
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import HeaderMenu from '../components/HeaderMenu.jsx'

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo–So
const PRIORITY_LABELS = { high: 'Hoch', normal: 'Normal', low: 'Niedrig' }
const TYPE_LABELS = { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', once: 'Einmalig' }

const EMPTY_FORM = { title: '', type: 'daily', priority: 'normal', weekdays: [], fixedWeekday: '', fixedDayOfMonth: '', dueDate: '', isActive: true, allowMultiple: false }

const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-orange-400'

function SortableTask({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-white dark:bg-gray-800" data-testid="sortable-task" data-task-title={task.title}>
      <div {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing text-lg" data-testid="drag-handle">⠿</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
          {!task.isActive && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-sm shrink-0">Inaktiv</span>}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {TYPE_LABELS[task.type]} · {PRIORITY_LABELS[task.priority]}
          {task.fixedWeekday != null && ` · ${WEEKDAY_LABELS[task.fixedWeekday]}`}
          {task.fixedDayOfMonth != null && ` · ${task.fixedDayOfMonth}.`}
          {task.weekdays?.length > 0 && ` · ${task.weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`}
          {task.allowMultiple && (task.type === 'daily' ? ' · Mehrfach am Tag' : ' · Mehrfach pro Woche')}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onEdit(task)} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">Bearb.</button>
        <button onClick={() => onDelete(task.id)} className="text-xs text-red-500 dark:text-red-400 hover:underline">Löschen</button>
      </div>
    </div>
  )
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('tasks')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  async function loadTasks() {
    try {
      const data = await api.get('/tasks/admin')
      setTasks(data)
    } catch {}
  }

  async function loadUsers() {
    try {
      const data = await api.get('/users')
      setUsers(data)
    } catch {}
  }

  useEffect(() => { Promise.all([loadTasks(), loadUsers()]) }, [])

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
    try { data = JSON.parse(text) } catch { alert('Ungültige JSON-Datei'); return }
    const result = await api.post('/tasks/admin/import', data)
    alert(result.message)
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
      alert(err.message)
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
    })
    setEditId(task.id)
    setShowForm(false)
  }

  async function deleteTask(id) {
    if (!confirm('Aufgabe wirklich löschen?')) return
    try {
      await api.delete(`/tasks/admin/${id}`)
      loadTasks()
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleUser(id) {
    const userRecord = users.find(u => u.id === id)
    if (userRecord?.approved) {
      if (!confirm(`Möchtest du "${userRecord.name}" wirklich sperren? Der Nutzer verliert sofort den Zugriff.`)) return
    }
    try {
      await api.post(`/users/${id}/approve`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  async function deleteUser(id) {
    const userRecord = users.find(u => u.id === id)
    if (!confirm(`Möchtest du "${userRecord.name}" (${userRecord.email}) wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return
    try {
      await api.delete(`/users/${id}`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleRole(id) {
    const userRecord = users.find(u => u.id === id)
    const action = userRecord?.role === 'admin' ? 'zum normalen Nutzer machen' : 'zum Admin machen'
    if (!confirm(`Möchtest du "${userRecord.name}" wirklich ${action}?`)) return
    try {
      await api.post(`/users/${id}/role`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  function toggleWeekday(day) {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter(d => d !== day) : [...f.weekdays, day],
    }))
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

  const taskFormFields = (
    <>
      <div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Titel</label>
        <input required className={inputCls}
          value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Typ</label>
          <select className={inputCls}
            value={form.type} onChange={e => {
              const type = e.target.value
              const today = new Date().toISOString().slice(0, 10)
              setForm(f => ({ ...f, type, dueDate: type === 'once' && !f.dueDate ? today : f.dueDate }))
            }}>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
            <option value="once">Einmalig</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priorität</label>
          <select className={inputCls}
            value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            <option value="high">Hoch</option>
            <option value="normal">Normal</option>
            <option value="low">Niedrig</option>
          </select>
        </div>
      </div>
      {form.type === 'daily' && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Wochentage (leer = täglich)</label>
          <div className="flex gap-1 flex-wrap">
            {WEEKDAY_ORDER.map(i => (
              <button type="button" key={i} onClick={() => toggleWeekday(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${form.weekdays.includes(i) ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >{WEEKDAY_LABELS[i]}</button>
            ))}
          </div>
        </div>
      )}
      {(form.type === 'daily' || form.type === 'weekly') && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="allowMultiple" checked={form.allowMultiple}
            onChange={e => setForm(f => ({ ...f, allowMultiple: e.target.checked }))} className="accent-orange-600" />
          <label htmlFor="allowMultiple" className="text-sm text-gray-600 dark:text-gray-400">
            {form.type === 'daily' ? 'Mehrfach am Tag erledigbar' : 'Mehrfach in der Woche erledigbar'}
          </label>
        </div>
      )}
      {form.type === 'weekly' && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Fixer Wochentag (optional)</label>
          <select className={inputCls}
            value={form.fixedWeekday} onChange={e => setForm(f => ({ ...f, fixedWeekday: e.target.value }))}>
            <option value="">Keiner</option>
            {WEEKDAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
      )}
      {form.type === 'monthly' && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Fixer Tag im Monat (optional)</label>
          <input type="number" min="1" max="31"
            className={inputCls}
            value={form.fixedDayOfMonth} onChange={e => setForm(f => ({ ...f, fixedDayOfMonth: e.target.value }))} />
        </div>
      )}
      {form.type === 'once' && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Fälligkeitsdatum</label>
          <input type="date" required
            className={inputCls}
            value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isActive" checked={form.isActive}
          onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-orange-600" />
        <label htmlFor="isActive" className="text-sm text-gray-600 dark:text-gray-400">Aktiv</label>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {editId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setEditId(null); setForm(EMPTY_FORM) }}>
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Aufgabe bearbeiten</h2>
              <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_FORM) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
            </div>
            {taskFormFields}
            <button type="submit" className="w-full bg-orange-600 text-white rounded-xl py-2 text-sm font-medium">Speichern</button>
          </form>
        </div>
      )}
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Verwaltung</h1>
          <HeaderMenu />
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('tasks')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${tab === 'tasks' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Aufgaben</button>
          <button onClick={() => setTab('users')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${tab === 'users' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Nutzer</button>
        </div>

        {tab === 'tasks' && (
          <div className="space-y-4">
            <button
              onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(s => !s) }}
              className="w-full bg-orange-600 text-white rounded-xl py-2.5 text-sm font-medium"
            >
              {showForm ? 'Abbrechen' : '+ Neue Aufgabe'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2 text-sm font-medium"
              >
                ↓ Exportieren
              </button>
              <label className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2 text-sm font-medium text-center cursor-pointer">
                ↑ Importieren
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                {taskFormFields}
                <button type="submit" className="w-full bg-orange-600 text-white rounded-xl py-2 text-sm font-medium">Aufgabe erstellen</button>
              </form>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {['daily', 'weekly', 'monthly', 'once'].map(type => {
                // Abfallkalender-Aufgaben werden nicht manuell verwaltet — sie
                // laufen ausschließlich über den Kalender-Sync (eigener
                // Abschnitt weiter unten), tauchen hier also nicht auf.
                const group = tasks.filter(t => t.type === type && !t.isAutoGenerated && (type !== 'once' || t.isActive))
                return (
                  <div key={type} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{TYPE_LABELS[type]}</span>
                    </div>
                    <SortableContext items={group.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {group.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 p-4 text-center">Keine Aufgaben</p>}
                      {group.map(task => (
                        <SortableTask key={task.id} task={task} onEdit={startEdit} onDelete={deleteTask} />
                      ))}
                    </SortableContext>
                  </div>
                )
              })}
            </DndContext>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abfallkalender</span>
              </div>
              {wasteTasks.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 p-4 text-center">Keine Termine</p>}
              {wasteTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {task.dueDate?.split('-').reverse().join('.')}
                      {' · '}
                      {task.isActive
                        ? <span className="text-orange-600 dark:text-orange-400">Bevorstehend</span>
                        : <span className="text-gray-400">Abgelaufen</span>}
                    </div>
                  </div>
                  {!task.isActive && (
                    <button onClick={() => deleteTask(task.id)} className="text-xs text-red-500 dark:text-red-400 hover:underline shrink-0">Löschen</button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400 dark:text-gray-500 p-3">
                Diese Termine werden automatisch über den Abfallkalender-Sync verwaltet. Abgelaufene Einträge können manuell gelöscht werden und werden nach 7 Tagen automatisch entfernt.
              </p>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {users.map(userRecord => (
              <div key={userRecord.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                data-testid="user-row" data-user-email={userRecord.email} data-user-role={userRecord.role} data-user-approved={userRecord.approved}>
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-700 dark:text-orange-400 font-medium text-sm shrink-0 mt-0.5">
                  {userRecord.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{userRecord.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{userRecord.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {userRecord.lastActiveAt
                      ? `Zuletzt aktiv: ${new Date(userRecord.lastActiveAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr`
                      : 'Noch nie aktiv'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {userRecord.role === 'admin' && (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1.5 rounded-lg font-medium">Admin</span>
                  )}
                  <button
                    onClick={() => toggleRole(userRecord.id)}
                    data-testid="toggle-role"
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium"
                  >
                    {userRecord.role === 'admin' ? '↓ Nutzer' : '↑ Admin'}
                  </button>
                  <button
                    onClick={() => toggleUser(userRecord.id)}
                    data-testid="toggle-approve"
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${userRecord.approved ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}
                  >
                    {userRecord.approved ? 'Sperren' : 'Freischalten'}
                  </button>
                  {userRecord.id !== currentUser?.id && (
                    <button
                      onClick={() => deleteUser(userRecord.id)}
                      data-testid="delete-user"
                      className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-lg font-medium"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
