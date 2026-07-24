export const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo–So
export const PRIORITY_LABELS = { high: 'Hoch', normal: 'Normal', low: 'Niedrig' }
export const TYPE_LABELS = { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', once: 'Einmalig' }

export const EMPTY_FORM = { title: '', type: 'daily', priority: 'normal', weekdays: [], fixedWeekday: '', fixedDayOfMonth: '', dueDate: '', isActive: true, allowMultiple: false, weatherDependent: false, pauseFrom: '', pauseTo: '' }

export const inputCls = 'w-full border border-outline rounded-control px-3 py-2 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'
