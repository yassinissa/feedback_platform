import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../lib/api'
import type { Me } from '../lib/types'

interface AuthValue {
  me: Me | null
  ready: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(() => !getToken())

  useEffect(() => {
    if (!getToken()) return
    api<Me>('/auth/me/')
      .then(setMe)
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const onLogout = () => setMe(null)
    window.addEventListener('fb:logout', onLogout)
    return () => window.removeEventListener('fb:logout', onLogout)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string; user: Me }>('/auth/login/', {
      method: 'POST',
      body: { username, password },
      auth: false,
    })
    setToken(res.token)
    setMe(res.user)
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout/', { method: 'POST' }).catch(() => undefined)
    setToken(null)
    setMe(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ me, ready, isAdmin: me?.role === 'admin', login, logout }),
    [me, ready, login, logout],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
