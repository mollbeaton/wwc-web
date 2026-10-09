import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { harvestsApi, orchardsApi } from '../../api/harvests'
import { lotsApi } from '../../api/lots'
import { PageHeader } from '../../components/PageHeader'
import { cap, shortDate } from '../../lib/format'
import { lotStatusPill } from '../../lib/lotStatus'
import styles from './TraceIndex.module.css'

/** Rows shown per column before "Show all" - enough to find something recent
 *  without the page becoming every lot the cidery has ever made. */
const PREVIEW_ROWS = 12

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

  // Someone holding a returned bottle types the code off its label - an
  // exact lot (or harvest) code goes straight there, no results list.
  const exactLot = q ? (lots.data ?? []).find((l) => l.code.toLowerCase() === q) : undefined
  if (exactLot) return <Navigate to={`/lots/${exactLot.id}?tab=trace`} replace />
  const exactHarvest = q ? (harvests.data ?? []).find((h) => h.code.toLowerCase() === q) : undefined
  if (exactHarvest) return <Navigate to={`/harvests/${exactHarvest.id}`} replace />

  return (
    <div>
      <PageHeader
        title="Trace"
        subtitle={q ? `Results for “${params.get('q')}”` : 'What went into a lot, and where it went'}
      />

      {/* Keyed on the search so "Show all" resets when the query changes. */}
      <div className={styles.columns} key={q}>
        <TraceColumn
          title="Lots"
          noun="lots"
          isPending={lots.isPending}
          isError={lots.isError}
          onRetry={() => lots.refetch()}
          rows={matchedLots.map((lot) => {
            const pill = lotStatusPill(lot)
            return (
              <Link key={lot.id} to={`/lots/${lot.id}`} className={styles.row}>
                <span className="mono">{lot.code}</span>
                <span className={styles.rowMain}>{lot.name ?? lot.kind.replace(/_/g, ' ')}</span>
                <span className={`pill ${pill.cls}`}>{pill.label}</span>
              </Link>
            )
          })}
        />

        <TraceColumn
          title="Harvests"
          noun="harvests"
          isPending={harvests.isPending}
          isError={harvests.isError}
          onRetry={() => harvests.refetch()}
          rows={matchedHarvests.map((h) => (
            <Link key={h.id} to={`/harvests/${h.id}`} className={styles.row}>
              <span className="mono">{h.code}</span>
              <span className={styles.rowMain}>
                {orchardName.get(h.orchard_id) ?? 'Orchard'} · {shortDate(h.harvested_on)}
              </span>
              <span className="pill pill--grey">{cap(h.fruit)}</span>
            </Link>
          ))}
        />
      </div>
    </div>
  )
}

function TraceColumn({
  title,
  noun,
  rows,
  isPending,
  isError,
  onRetry,
}: {
  title: string
  noun: string
  rows: ReactNode[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS)

  return (
    <div className="card">
      <div className={styles.columnHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {!isPending && !isError && <span className={styles.count}>{rows.length}</span>}
      </div>

      {isPending &&
        Array.from({ length: 5 }, (_, i) => <div key={i} className={`skeleton ${styles.rowSkeleton}`} />)}
      {isError && (
        <p className="muted">
          Couldn’t load {noun}.{' '}
          <button type="button" className="text-link" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      {!isPending && !isError && rows.length === 0 && <p className="muted">No {noun}.</p>}

      {visible}

      {rows.length > PREVIEW_ROWS && (
        <button type="button" className={`text-link ${styles.more}`} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${rows.length} ${noun}`}
        </button>
      )}
    </div>
  )
}
