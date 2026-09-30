import { IconLogout, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import styles from './TopBar.module.css'

export function TopBar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(`/trace?q=${encodeURIComponent(search.trim())}`)
  }
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
      <form className={styles.search} onSubmit={onSearch}>
        <IconSearch size={18} stroke={1.75} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Search lots and harvests…"
          aria-label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className={styles.right}>
        <span className={styles.date}>{today}</span>
        <button className={styles.signout} onClick={signOut} title="Sign out">
          <IconLogout size={18} stroke={1.75} />
        </button>
      </div>
    </header>
  )
}
