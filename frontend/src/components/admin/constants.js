export const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo–So
export const PRIORITY_LABELS = { high: 'Hoch', normal: 'Normal', low: 'Niedrig' }
export const TYPE_LABELS = { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', once: 'Einmalig' }

export const EMPTY_FORM = { title: '', type: 'daily', priority: 'normal', weekdays: [], fixedWeekday: '', fixedDayOfMonth: '', dueDate: '', isActive: true, allowMultiple: false, weatherDependent: false }

export const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-orange-400'
