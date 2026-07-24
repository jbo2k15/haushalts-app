import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'

// Nutzerverwaltung: Liste mit Rollen-/Freischalt-/Lösch-Aktionen. Reines
// Präsentations-Component; Bestätigungen und API-Aufrufe liegen in den
// übergebenen Callbacks (seit dem IA-Umbau in Settings.jsx, siehe REDESIGN.md).
export default function UsersTab({ users, currentUserId, onToggleRole, onToggleApprove, onDeleteUser }) {
  return (
    <Card className="overflow-hidden">
      {users.map(userRecord => (
        <div key={userRecord.id} className="flex items-start gap-3 px-4 py-3 border-b border-outline last:border-b-0"
          data-testid="user-row" data-user-email={userRecord.email} data-user-role={userRecord.role} data-user-approved={userRecord.approved}>
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-medium text-sm shrink-0 mt-0.5">
            {userRecord.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{userRecord.name}</p>
            <p className="text-xs text-ink-faint truncate">{userRecord.email}</p>
            <p className="text-xs text-ink-faint mt-0.5">
              {userRecord.lastActiveAt
                ? `Zuletzt aktiv: ${new Date(userRecord.lastActiveAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr`
                : 'Noch nie aktiv'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {userRecord.role === 'admin' && (
              <Badge tone="primary" className="px-2 py-1.5">Admin</Badge>
            )}
            <button
              onClick={() => onToggleRole(userRecord.id)}
              data-testid="toggle-role"
              className="text-xs bg-surface-container-high text-ink-muted px-3 py-1.5 rounded-lg font-medium"
            >
              {userRecord.role === 'admin' ? '↓ Nutzer' : '↑ Admin'}
            </button>
            <button
              onClick={() => onToggleApprove(userRecord.id)}
              data-testid="toggle-approve"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${userRecord.approved ? 'bg-danger-container text-on-danger-container' : 'bg-success-container text-on-success-container'}`}
            >
              {userRecord.approved ? 'Sperren' : 'Freischalten'}
            </button>
            {userRecord.id !== currentUserId && (
              <button
                onClick={() => onDeleteUser(userRecord.id)}
                data-testid="delete-user"
                className="text-xs bg-danger-container text-on-danger-container px-3 py-1.5 rounded-lg font-medium"
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      ))}
    </Card>
  )
}
