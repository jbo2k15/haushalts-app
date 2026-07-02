const WINDOW_MS = 60 * 60 * 1000
const THRESHOLD = 20

let failedAttempts = []

export function recordFailedLogin() {
  const now = Date.now()
  failedAttempts.push(now)
  failedAttempts = failedAttempts.filter(t => now - t < WINDOW_MS)

  if (failedAttempts.length === THRESHOLD) {
    console.warn(`[SECURITY] ${THRESHOLD} fehlgeschlagene Login-Versuche in der letzten Stunde — möglicher Brute-Force-Versuch.`)
  }
}
