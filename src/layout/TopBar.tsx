import { IconLogout, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import styles from './TopBar.module.css'

export function TopBar() {
  const { signOut } = useAuth()
  // Resolved once at mount rather than on every render (the date doesn't change
  // while the page is open).
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  )

  return (
    <header className={styles.topbar}>
      <div className={styles.search}>
        <IconSearch size={18} stroke={1.75} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Search lots, harvests, suppliers, vessels…"
          aria-label="Search"
        />
      </div>
      <div className={styles.right}>
        <span className={styles.date}>{today}</span>
        <button className={styles.signout} onClick={signOut} title="Sign out">
          <IconLogout size={18} stroke={1.75} />
        </button>
      </div>
    </header>
  )
}
