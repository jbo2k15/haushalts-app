// Nutzerverwaltung (Admin-Tab "Nutzer"): Liste mit Rollen-/Freischalt-/Lösch-
// Aktionen. Reines Präsentations-Component; Bestätigungen und API-Aufrufe
// liegen in den übergebenen Callbacks (Admin.jsx).
export default function UsersTab({ users, currentUserId, onToggleRole, onToggleApprove, onDeleteUser }) {
  return (
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
              onClick={() => onToggleRole(userRecord.id)}
              data-testid="toggle-role"
              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium"
            >
              {userRecord.role === 'admin' ? '↓ Nutzer' : '↑ Admin'}
            </button>
            <button
              onClick={() => onToggleApprove(userRecord.id)}
              data-testid="toggle-approve"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${userRecord.approved ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}
            >
              {userRecord.approved ? 'Sperren' : 'Freischalten'}
            </button>
            {userRecord.id !== currentUserId && (
              <button
                onClick={() => onDeleteUser(userRecord.id)}
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
  )
}
