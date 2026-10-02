import { NavLink } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { MAIN_NAV, MANAGE_NAV, visibleFor, type NavItem } from './nav'
import styles from './Sidebar.module.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  cellar: 'Cellar',
  viewer: 'Viewer',
}

export function Sidebar() {
  const { user, effectiveRole, previewRole, setPreviewRole } = useAuth()
  const mainItems = visibleFor(MAIN_NAV, effectiveRole)
  const manageItems = visibleFor(MANAGE_NAV, effectiveRole)

  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>Wild West Cider</span>
        <span className={styles.brandSub}>Cellar office</span>
      </div>

      <div className={styles.group}>
        {mainItems.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </div>

      {manageItems.length > 0 && (
        <>
          <div className={styles.groupHeading}>Manage</div>
          <div className={styles.group}>
            {manageItems.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
          </div>
        </>
      )}

      {/* Role preview (WD-31): lets an admin see what a Cellar or Viewer sees.
          Admin-only - since it drives effectiveRole (which route guards read),
          exposing it to lower roles would let them unlock the UI for themselves
          (the API still enforces, but the chrome shouldn't invite it). */}
      {user?.role === 'admin' && (
        <div className={styles.footer}>
          <label className={styles.previewLabel}>Preview role</label>
          <select
            className={styles.previewSelect}
            value={previewRole ?? user.role}
            onChange={(e) => {
              const next = e.target.value as Role
              setPreviewRole(next === user.role ? null : next)
            }}
          >
            {(['admin', 'cellar', 'viewer'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
                {r === user.role ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
    >
      <Icon size={19} stroke={1.75} />
      <span>{item.label}</span>
    </NavLink>
  )
}
