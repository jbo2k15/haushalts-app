import { useEffect, useState } from 'react'
import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import HeaderMenu from '../components/HeaderMenu.jsx'
import TaskFormFields from '../components/admin/TaskFormFields.jsx'
import TasksTab from '../components/admin/TasksTab.jsx'
import UsersTab from '../components/admin/UsersTab.jsx'
import { EMPTY_FORM } from '../components/admin/constants.js'

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
      weatherDependent: task.weatherDependent || false,
      pauseFrom: task.pauseFrom || '',
      pauseTo: task.pauseTo || '',
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {editId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-heading"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 id="edit-task-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-200">Aufgabe bearbeiten</h2>
              <button type="button" onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
            </div>
            <TaskFormFields form={form} setForm={setForm} />
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
        )}

        {tab === 'users' && (
          <UsersTab
            users={users}
            currentUserId={currentUser?.id}
            onToggleRole={toggleRole}
            onToggleApprove={toggleUser}
            onDeleteUser={deleteUser}
          />
        )}
      </div>
    </div>
  )
}
