import { IconLogout, IconMenu2, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import styles from './TopBar.module.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  cellar: 'Cellar',
  viewer: 'Viewer',
}

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, effectiveRole, previewRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(`/trace?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <header className={styles.topbar}>
      <button type="button" className={`${styles.iconBtn} ${styles.menu}`} onClick={onOpenNav} aria-label="Open menu">
        <IconMenu2 size={19} stroke={1.75} />
      </button>
      <form className={styles.search} onSubmit={onSearch} role="search">
        <IconSearch size={18} stroke={1.75} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Search lots and harvests…"
          aria-label="Search lots and harvests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className={styles.right}>
        {user && effectiveRole && (
          <div className={styles.who}>
            <span className={styles.email}>{user.email}</span>
            {/* While an admin previews a lower role, say so plainly - otherwise
                missing nav items look like a bug. */}
            <span className={`pill ${previewRole ? 'pill--blue' : 'pill--grey'}`}>
              {previewRole ? `Previewing ${ROLE_LABELS[effectiveRole]}` : ROLE_LABELS[effectiveRole]}
            </span>
          </div>
        )}
        <button type="button" className={styles.iconBtn} onClick={signOut} aria-label="Sign out" title="Sign out">
          <IconLogout size={18} stroke={1.75} />
        </button>
      </div>
    </header>
  )
}
