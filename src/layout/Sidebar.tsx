import { IconX } from '@tabler/icons-react'
import { useEffect, useId } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { MAIN_NAV, MANAGE_NAV, visibleFor, type NavItem } from './nav'
import styles from './Sidebar.module.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  cellar: 'Cellar',
  viewer: 'Viewer',
}

/** The app's nav. A fixed column on wide screens; below 900px it's a drawer
 *  that `open` slides in over the page (opened from the top bar's menu). */
export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user, effectiveRole, previewRole, setPreviewRole } = useAuth()
  const mainItems = visibleFor(MAIN_NAV, effectiveRole)
  const manageItems = visibleFor(MANAGE_NAV, effectiveRole)
  const previewId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
    {open && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
    <nav className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Main">
      <div className={styles.brand}>
        <div>
          <span className={styles.brandName}>Wild West Cider</span>
          <span className={styles.brandSub}>Cellar office</span>
        </div>
        {onClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close menu">
            <IconX size={18} stroke={1.9} />
          </button>
        )}
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
          <label className={styles.previewLabel} htmlFor={previewId}>
            Preview role
          </label>
          <select
            id={previewId}
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
    </>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  const { pathname } = useLocation()
  const inSection = item.alsoActiveFor?.some((prefix) => pathname.startsWith(prefix)) ?? false
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `${styles.item} ${isActive || inSection ? styles.active : ''}`}
    >
      <Icon size={19} stroke={1.75} />
      <span>{item.label}</span>
    </NavLink>
  )
}
