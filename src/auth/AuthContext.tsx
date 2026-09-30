import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, login as apiLogin } from '../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../api/client'
import type { CurrentUser, Role } from '../api/types'

interface AuthState {
  user: CurrentUser | null
  /** True until we've resolved the stored token (if any) into a user. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  /** Demo-only role preview (WD-31 role switch); null = use the real role. */
  previewRole: Role | null
  setPreviewRole: (role: Role | null) => void
  /** The role the UI should gate on: the previewed role if set, else the real one. */
  effectiveRole: Role | null
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  // Start "loading" only if there's a token to resolve; otherwise we already
  // know there's no user, so the login screen can show immediately.
  const [loading, setLoading] = useState(() => !!tokenStore.get())
  const [previewRole, setPreviewRole] = useState<Role | null>(null)

  const signOut = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setPreviewRole(null)
  }, [])

  // A 401 on any request means the token's gone stale - drop straight back to
  // the login screen rather than leaving half-loaded pages up.
  useEffect(() => {
    setUnauthorizedHandler(signOut)
  }, [signOut])

  // Resolve a token left over from a previous session into a user on boot.
  useEffect(() => {
    if (!tokenStore.get()) return
    fetchCurrentUser()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password)
    setUser(await fetchCurrentUser())
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      previewRole,
      setPreviewRole,
      effectiveRole: previewRole ?? user?.role ?? null,
    }),
    [user, loading, signIn, signOut, previewRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
