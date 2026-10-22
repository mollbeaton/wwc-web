import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from './AuthContext'
import { homePath } from './roles'

/** Gates the whole app behind a signed-in user; sends anyone else to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Gates a route to specific roles; others get bounced to their home page
 *  (Tanks, or Stock for a seller). Enforced in the API too - this only keeps
 *  the UI honest (WD-31). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { effectiveRole } = useAuth()
  if (!effectiveRole || !roles.includes(effectiveRole)) {
    return <Navigate to={homePath(effectiveRole)} replace />
  }
  return <>{children}</>
}

/** The index route: each role's home page. */
export function HomeRedirect() {
  const { effectiveRole } = useAuth()
  return <Navigate to={homePath(effectiveRole)} replace />
}

function FullPageSpinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <span className="muted">Loading…</span>
    </div>
  )
}
