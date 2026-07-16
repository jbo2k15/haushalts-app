// Kleiner Helfer für Domänenfehler mit HTTP-Status. Der globale Error-Handler
// in app.js wertet `err.status` aus und antwortet für <500 mit `err.message`,
// für >=500 generisch. Domänenfunktionen werfen damit z.B. httpError(404, '…'),
// ohne die HTTP-Schicht kennen zu müssen; Express 5 leitet den geworfenen
// Fehler aus async-Handlern automatisch an den Error-Handler weiter.
export function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}
