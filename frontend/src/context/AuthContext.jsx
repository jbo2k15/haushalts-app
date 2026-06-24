import { createContext, useContext, useState, useEffect } from 'react'
import { api, setAccessToken, clearAccessToken, refreshSession } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Beim App-Start: Refresh-Cookie nutzen um neuen Access-Token zu holen
    refreshSession()
      .then(data => {
        if (data) {
          setAccessToken(data.token)
          setUser(data.user)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function login(token, userData) {
    setAccessToken(token)
    setUser(userData)
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    clearAccessToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
