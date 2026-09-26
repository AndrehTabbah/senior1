import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    api.auth
      .me()
      .then((u) => alive && setUser(u))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const signIn = useCallback(async (creds) => {
    const u = await api.auth.signIn(creds)
    setUser(u)
    return u
  }, [])

  const signUp = useCallback(async (payload) => {
    const u = await api.auth.signUp(payload)
    setUser(u)
    return u
  }, [])

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, ready, signIn, signUp, signOut }), [user, ready, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
