import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import styles from './AppShell.module.css'

export function AppShell() {
  // Below 900px the sidebar becomes a drawer opened from the top bar. It's
  // remembered as "open on this page", so following a nav link closes it.
  const { pathname } = useLocation()
  const [openOn, setOpenOn] = useState<string | null>(null)
  const navOpen = openOn === pathname

  return (
    <div className={styles.shell}>
      <Sidebar open={navOpen} onClose={() => setOpenOn(null)} />
      <div className={styles.main}>
        <TopBar onOpenNav={() => setOpenOn(pathname)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
