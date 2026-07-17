import { WEEKDAY_LABELS, WEEKDAY_ORDER, inputCls } from './constants.js'

// Die Formularfelder für eine Aufgabe (geteilt zwischen "Neue Aufgabe" und dem
// Bearbeiten-Modal). Kontrolliert über form/setForm des Elternteils.
export default function TaskFormFields({ form, setForm }) {
  function toggleWeekday(day) {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter(d => d !== day) : [...f.weekdays, day],
    }))
  }

  return (
    <>
      <div>
        <label htmlFor="task-title" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Titel</label>
        <input id="task-title" required className={inputCls}
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
      {form.type === 'daily' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="weatherDependent" checked={form.weatherDependent}
            onChange={e => setForm(f => ({ ...f, weatherDependent: e.target.checked }))} className="accent-orange-600" />
          <label htmlFor="weatherDependent" className="text-sm text-gray-600 dark:text-gray-400">
            Wetterabhängig (entfällt bei Regen)
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
}
