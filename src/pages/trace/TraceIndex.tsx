import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { harvestsApi, orchardsApi } from '../../api/harvests'
import { lotsApi } from '../../api/lots'
import { PageHeader } from '../../components/PageHeader'
import { shortDate } from '../../lib/format'
import { lotStatusPill } from '../../lib/lotStatus'
import styles from './TraceIndex.module.css'

export function TraceIndex() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim().toLowerCase()

  const lots = useQuery({ queryKey: ['lots'], queryFn: lotsApi.list })
  const harvests = useQuery({ queryKey: ['harvests'], queryFn: harvestsApi.list })
  const orchards = useQuery({ queryKey: ['orchards'], queryFn: orchardsApi.list })

  const orchardName = new Map((orchards.data ?? []).map((o) => [o.id, o.name]))

  const matchedLots = (lots.data ?? []).filter(
    (l) => !q || l.code.toLowerCase().includes(q) || (l.name ?? '').toLowerCase().includes(q),
  )
  const matchedHarvests = (harvests.data ?? []).filter((h) => {
    if (!q) return true
    const hay = [
      h.code,
      orchardName.get(h.orchard_id) ?? '',
      ...h.varieties.map((v) => v.variety),
      h.harvested_on,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Trace"
        subtitle={q ? `Results for “${params.get('q')}”` : 'What went into a lot, and where it went'}
      />

      <div className={styles.columns}>
        <div className="card">
          <h3 className={styles.sectionTitle}>Lots</h3>
          {matchedLots.length === 0 && <p className={styles.muted}>No lots.</p>}
          {matchedLots.map((lot) => {
            const pill = lotStatusPill(lot)
            return (
              <Link key={lot.id} to={`/lots/${lot.id}`} className={styles.row}>
                <span className="mono">{lot.code}</span>
                <span className={styles.rowMain}>{lot.name ?? lot.kind.replace(/_/g, ' ')}</span>
                <span className={`pill ${pill.cls}`}>{pill.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="card">
          <h3 className={styles.sectionTitle}>Harvests</h3>
          {matchedHarvests.length === 0 && <p className={styles.muted}>No harvests.</p>}
          {matchedHarvests.map((h) => (
            <Link key={h.id} to={`/harvests/${h.id}`} className={styles.row}>
              <span className="mono">{h.code}</span>
              <span className={styles.rowMain}>
                {orchardName.get(h.orchard_id) ?? 'Orchard'} · {shortDate(h.harvested_on)}
              </span>
              <span className="pill pill--grey">{cap(h.fruit)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
