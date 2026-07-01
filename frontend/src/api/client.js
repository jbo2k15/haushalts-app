const BASE = '/api'

let accessToken = null
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

export function getAccessToken() {
  return accessToken
}

async function doRefresh() {
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
  if (!res.ok) { accessToken = null; return false }
  const data = await res.json()
  accessToken = data.token
  return data
}

// Verhindert parallele Refresh-Requests
export async function refreshSession() {
  if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

async function request(method, path, body, retry = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  // Access-Token abgelaufen → einmal refreshen und wiederholen
  if (res.status === 401 && retry && !path.includes('/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) return request(method, path, body, false)
    accessToken = null
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Serverfehler' }))
    throw new Error(err.error || 'Unbekannter Fehler')
  }

  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path, body) => request('DELETE', path, body),
}
