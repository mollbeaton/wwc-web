import { useQuery } from '@tanstack/react-query'
import { IconClockExclamation } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tanksApi, type VesselCard } from '../../api/tanks'
import { ApiError } from '../../api/client'
import { AbvTag } from '../../components/AbvTag'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import { cap, fixed, vesselTypeLabel } from '../../lib/format'
import styles from './TanksPage.module.css'

const STALE_DAYS = 14

type ShowFilter = 'all' | 'occupied' | 'empty'

function isStale(v: VesselCard): boolean {
  const days = v.lot?.days_since_last_event
  return days != null && days >= STALE_DAYS
}

export function TanksPage() {
  const query = useQuery({ queryKey: ['tanks', 'overview'], queryFn: tanksApi.overview })

  const [type, setType] = useState('all')
  const [product, setProduct] = useState('all')
  const [show, setShow] = useState<ShowFilter>('all')
  const [attentionOnly, setAttentionOnly] = useState(false)

  const vessels = query.data?.vessels ?? []
  const types = ['all', ...Array.from(new Set(vessels.map((v) => v.type)))]
  const staleCount = vessels.filter(isStale).length

  const filtered = vessels.filter((v) => {
    if (type !== 'all' && v.type !== type) return false
    if (show === 'occupied' && !v.lot) return false
    if (show === 'empty' && v.lot) return false
    if (product !== 'all' && v.lot?.product_type !== product) return false
    if (attentionOnly && !isStale(v)) return false
    return true
  })

  const summary = query.data?.summary

  return (
    <div>
      <PageHeader title="Tanks" subtitle="What's in every vessel right now" />

      {query.isLoading && <TanksSkeleton />}
      {query.error && (
        <p className={styles.error}>
          {query.error instanceof ApiError ? query.error.message : 'Could not load the tanks'}
        </p>
      )}

      {summary && (
        <div className={styles.summary}>
          <Stat label="Cider in vessels" value={`${fixed(summary.cider_litres, 0)} L`} />
          <Stat label="Wine in vessels" value={`${fixed(summary.wine_litres, 0)} L`} />
          <Stat label="Empty vessels" value={String(summary.empty_vessel_count)} />
          <Stat
            label="Released this month"
            value={`${fixed(summary.released_this_month_l, 0)} L`}
          />
        </div>
      )}

      {query.data && (
        <div className={styles.filters}>
          <Segmented
            label="Type"
            options={types.map((t) => ({ value: t, label: t === 'all' ? 'All' : vesselTypeLabel(t) }))}
            value={type}
            onChange={setType}
          />
          <Segmented
            label="Product"
            options={[
              { value: 'all', label: 'All' },
              { value: 'cider', label: 'Cider' },
              { value: 'wine', label: 'Wine' },
            ]}
            value={product}
            onChange={setProduct}
          />
          <Segmented
            label="Show"
            options={[
              { value: 'all', label: 'All' },
              { value: 'occupied', label: 'Occupied' },
              { value: 'empty', label: 'Empty' },
            ]}
            value={show}
            onChange={(v) => setShow(v as ShowFilter)}
          />
          {staleCount > 0 && (
            <button
              type="button"
              aria-pressed={attentionOnly}
              className={`${styles.attention} ${attentionOnly ? styles.attentionOn : ''}`}
              onClick={() => setAttentionOnly((on) => !on)}
              title={`Lots with no activity for ${STALE_DAYS}+ days`}
            >
              <IconClockExclamation size={16} stroke={1.9} />
              {staleCount} need{staleCount === 1 ? 's' : ''} attention
            </button>
          )}
        </div>
      )}

      <div className={styles.grid}>
        {filtered.map((v) => (
          <VesselCardView key={v.vessel_id} vessel={v} />
        ))}
      </div>
      {query.data && filtered.length === 0 && (
        <p className="muted">No vessels match these filters.</p>
      )}
    </div>
  )
}

/** Placeholder cards in the shape of the real page while it loads, so the
 *  summary and grid don't pop in and shove each other around. */
function TanksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading tanks">
      <div className={styles.summary}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`skeleton ${styles.statSkeleton}`} />
        ))}
      </div>
      <div className={styles.grid}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`mono ${styles.statValue}`}>{value}</div>
    </div>
  )
}

function VesselCardView({ vessel }: { vessel: VesselCard }) {
  if (!vessel.lot) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        <div className={styles.cardTop}>
          <span className={styles.vesselName}>{vessel.name ?? vessel.code}</span>
          <span className="pill pill--grey">{vesselTypeLabel(vessel.type)}</span>
        </div>
        <div className={styles.emptyState}>
          Empty · {fixed(vessel.capacity_l, 0)} L capacity
        </div>
      </div>
    )
  }

  const lot = vessel.lot
  const stale = isStale(vessel)
  const dotClass =
    lot.product_type === 'wine' ? styles.dotWine : lot.product_type === 'cider' ? styles.dotCider : ''

  return (
    <Link to={`/lots/${lot.lot_id}`} className={`${styles.card} ${stale ? styles.cardStale : ''}`}>
      <div className={styles.cardTop}>
        <span className={styles.vesselName}>{vessel.name ?? vessel.code}</span>
        <span className="pill pill--grey">{vesselTypeLabel(vessel.type)}</span>
      </div>

      <div className={`mono ${styles.lotCode}`}>{lot.code}</div>

      <div className={styles.product}>
        {dotClass && <span className={`${styles.dot} ${dotClass}`} />}
        {(lot.display_type ?? lot.product_type) ? cap(lot.display_type ?? lot.product_type!) : 'Lot'}
        {lot.varieties.length > 0 && (
          <span className={styles.varieties}> · {lot.varieties.slice(0, 3).join(', ')}</span>
        )}
      </div>

      <div className={`mono ${styles.volume}`}>{fixed(lot.current_volume_l, 0)} L</div>
      <div className={styles.capacity}>
        of {fixed(vessel.capacity_l, 0)} L · {lot.fill_pct}%
      </div>
      <div className={styles.fillTrack}>
        <div
          className={`${styles.fillBar} ${lot.product_type === 'wine' ? styles.fillWine : ''}`}
          style={{ width: `${Math.min(lot.fill_pct, 100)}%` }}
        />
      </div>

      <div className={styles.readings}>
        <span>
          SG <span className="mono">{lot.latest_sg ?? '—'}</span>
        </span>
        <span>
          ABV{' '}
          <span className="mono">{lot.abv ? `${lot.abv}%` : '—'}</span>{' '}
          {lot.abv_method && (
            <AbvTag method={lot.abv_method} />
          )}
        </span>
      </div>

      {lot.days_since_last_event != null && (
        <div className={`${styles.days} ${stale ? styles.daysStale : ''}`}>
          {stale && <IconClockExclamation size={15} stroke={1.9} />}
          {lot.days_since_last_event === 0
            ? 'Active today'
            : `${lot.days_since_last_event}d since last event`}
        </div>
      )}
    </Link>
  )
}
