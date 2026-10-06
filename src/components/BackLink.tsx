import { IconArrowLeft } from '@tabler/icons-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styles from './BackLink.module.css'

/** Goes back to wherever you came from inside the app (Trace, a harvest, a
 *  parent lot…). On a fresh tab or a pasted link there's no in-app history,
 *  so it falls back to a named destination instead of leaving the app. */
export function BackLink({ fallbackTo, fallbackLabel }: { fallbackTo: string; fallbackLabel: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  // React Router gives the very first entry of a session the key "default".
  const hasHistory = location.key !== 'default'

  if (hasHistory) {
    return (
      <button type="button" className={styles.back} onClick={() => navigate(-1)}>
        <IconArrowLeft size={16} stroke={1.9} />
        Back
      </button>
    )
  }
  return (
    <Link to={fallbackTo} className={styles.back}>
      <IconArrowLeft size={16} stroke={1.9} />
      {fallbackLabel}
    </Link>
  )
}
