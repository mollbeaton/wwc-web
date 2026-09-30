import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from './AuthContext'

/** Gates the whole app behind a signed-in user; sends anyone else to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Gates a route to specific roles; others get bounced to Tanks. Enforced in
 *  the API too - this only keeps the UI honest (WD-31). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { effectiveRole } = useAuth()
  if (!effectiveRole || !roles.includes(effectiveRole)) {
    return <Navigate to="/tanks" replace />
  }
  return <>{children}</>
}

function FullPageSpinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <span style={{ color: 'var(--ink-muted)' }}>Loading…</span>
    </div>
  )
}
