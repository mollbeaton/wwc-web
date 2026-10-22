import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { locationsApi } from '../../api/catalog'
import { stockApi } from '../../api/stock'
import { PageHeader } from '../../components/PageHeader'
import { errorText } from '../../lib/stock'
import styles from './Stock.module.css'

const GRID = 'minmax(180px, 1.6fr) 120px 140px'

/** Open events and the stock sent to each, with the way into closing one
 *  out. Sellers reach close-out from here; admins also from Manage →
 *  Locations. */
export function EventsPage() {
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })

  const events = (locations.data ?? []).filter((l) => l.kind === 'event' && l.status === 'active')
  const unitsAt = (locationId: string) =>
    (stock.data ?? []).reduce(
      (sum, r) => sum + (r.by_location.find((l) => l.location_id === locationId)?.qty ?? 0),
      0,
    )

  return (
    <div>
      <PageHeader title="Events" subtitle="Open events: send stock with a transfer, close out when it’s over" />
      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Open events">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Event</span>
            <span role="columnheader" className={styles.num}>Units there</span>
            <span role="columnheader" />
          </div>
          {events.map((e) => (
            <div key={e.id} className={styles.row} style={{ gridTemplateColumns: GRID }} role="row">
              <span role="cell" className={styles.strong}>{e.name}</span>
              <span role="cell" className={`mono ${styles.num}`}>{stock.data ? unitsAt(e.id) : '—'}</span>
              <span role="cell" className={styles.cellActions}>
                <Link to={`/stock/events/${e.id}/close-out`} className="text-link">
                  Close out
                </Link>
              </span>
            </div>
          ))}
          {locations.isPending && <p className={styles.empty}>Loading…</p>}
          {locations.isError && <p className={styles.empty}>{errorText(locations.error, 'Couldn’t load events.')}</p>}
          {locations.data && events.length === 0 && <p className={styles.empty}>No open events.</p>}
        </div>
      </div>
    </div>
  )
}
