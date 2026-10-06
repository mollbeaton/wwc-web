import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { lotsApi, type Lot } from '../../api/lots'
import { AbvTag } from '../../components/AbvTag'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import { cap, fixed, lotKindLabel, shortDate } from '../../lib/format'
import { isAwaitingRelease, isReady } from '../../lib/lotStatus'
import styles from './ReadyForSalePage.module.css'

/** Rows shown before "Show all" - the ready list only ever grows, since the
 *  system stops tracking a lot once it's released. */
const PREVIEW_ROWS = 25

type Period = 'month' | '90' | 'all'

function inPeriod(iso: string | null, period: Period, now: Date): boolean {
  if (period === 'all') return true
  if (!iso) return false
  const when = new Date(iso)
  if (period === 'month') {
    return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth()
  }
  return now.getTime() - when.getTime() <= 90 * 864e5
}

/** Newest release first; anything without a date (shouldn't happen) last. */
function byReadyDesc(a: Lot, b: Lot): number {
  return (b.ready_for_sale_at ?? '').localeCompare(a.ready_for_sale_at ?? '')
}

export function ReadyForSalePage() {
  const lots = useQuery({ queryKey: ['lots'], queryFn: lotsApi.list })
  const [period, setPeriod] = useState<Period>('all')
  const [now] = useState(() => new Date())

  const all = lots.data ?? []
  const awaiting = all.filter(isAwaitingRelease).sort((a, b) => b.code.localeCompare(a.code))
  const ready = all
    .filter((l) => isReady(l) && inPeriod(l.ready_for_sale_at, period, now))
    .sort(byReadyDesc)

  return (
    <div>
      <PageHeader title="Ready for sale" subtitle="Packaged stock: what’s been released, and what’s waiting" />

      {lots.isPending && <PageSkeleton />}
      {lots.isError && (
        <p className="muted">
          {lots.error instanceof ApiError ? lots.error.message : 'Couldn’t load lots.'}{' '}
          <button type="button" className="text-link" onClick={() => lots.refetch()}>
            Retry
          </button>
        </p>
      )}

      {lots.data && (
        <>
          <Section
            title="Ready for sale"
            count={ready.length}
            note="Marked ready in the cellar app. Duty is due on these in the month they were released."
            controls={
              <Segmented
                label="Released"
                options={[
                  { value: 'month', label: 'This month' },
                  { value: '90', label: 'Last 90 days' },
                  { value: 'all', label: 'All' },
                ]}
                value={period}
                onChange={(v) => setPeriod(v as Period)}
              />
            }
          >
            <LotTable
              key={period}
              label="Ready for sale"
              lots={ready}
              empty={period === 'all' ? 'Nothing has been marked ready for sale yet.' : 'Nothing released in this period.'}
              dateHeader="Ready"
              date={(l) => (l.ready_for_sale_at ? shortDate(l.ready_for_sale_at) : '—')}
              volume={(l) => l.ready_for_sale_volume_l}
            />
          </Section>

          <Section
            title="Awaiting release"
            count={awaiting.length}
            note="Bottled or boxed but not yet marked ready. Mark them ready in the cellar app."
          >
            <LotTable
              label="Awaiting release"
              lots={awaiting}
              empty="Nothing packaged is waiting to be released."
              dateHeader="Labelled"
              date={(l) => (l.labelled_at ? shortDate(l.labelled_at) : 'Not yet')}
              volume={(l) => l.current_volume_l}
            />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  note,
  controls,
  children,
}: {
  title: string
  count: number
  note: string
  controls?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            {title} <span className={styles.count}>{count}</span>
          </h2>
          <p className={styles.note}>{note}</p>
        </div>
        {controls}
      </div>
      {children}
    </section>
  )
}

function LotTable({
  label,
  lots,
  empty,
  dateHeader,
  date,
  volume,
}: {
  label: string
  lots: Lot[]
  empty: string
  dateHeader: string
  date: (lot: Lot) => string
  volume: (lot: Lot) => string
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? lots : lots.slice(0, PREVIEW_ROWS)

  if (lots.length === 0) return <div className="card muted">{empty}</div>

  return (
    <div className="card card--flush">
      <div className={styles.scroll} role="table" aria-label={label}>
        <div className={`${styles.row} ${styles.head}`} role="row">
          <span role="columnheader">Lot</span>
          <span role="columnheader">Product</span>
          <span role="columnheader">Format</span>
          <span role="columnheader" className={styles.num}>ABV</span>
          <span role="columnheader" className={styles.num}>Volume</span>
          <span role="columnheader" className={styles.num}>{dateHeader}</span>
        </div>
        {visible.map((lot) => (
          <Link key={lot.id} to={`/lots/${lot.id}`} className={styles.row} role="row">
            <span role="cell" className={`${styles.lot} ${styles.cLot}`}>
              <span className="mono">{lot.code}</span>
              {lot.name && <span className={styles.sub}>{lot.name}</span>}
            </span>
            <span role="cell" className={styles.cProduct}>
              {productLabel(lot)}
              <span className={styles.sub}>{productDetail(lot)}</span>
            </span>
            <span role="cell" className={styles.cFormat}>
              {lotKindLabel(lot.kind)}
              {lot.unit_count != null && lot.unit_volume_l != null && (
                <span className={`mono ${styles.sub}`}>
                  {lot.unit_count} × {lot.unit_volume_l} L
                </span>
              )}
            </span>
            <span role="cell" className={`mono ${styles.num} ${styles.cAbv}`}>
              {lot.abv ? (
                <>
                  {lot.abv}% {lot.abv_method && <AbvTag method={lot.abv_method} />}
                </>
              ) : (
                '—'
              )}
            </span>
            <span role="cell" className={`mono ${styles.num} ${styles.cVolume}`}>
              {fixed(volume(lot), 1)} L
            </span>
            <span role="cell" className={`${styles.num} ${styles.cDate}`}>
              <span className={styles.dateLabel}>{dateHeader} </span>
              {date(lot)}
            </span>
          </Link>
        ))}
      </div>
      {lots.length > PREVIEW_ROWS && (
        <div className={styles.more}>
          <button type="button" className="text-link" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show fewer' : `Show all ${lots.length}`}
          </button>
        </div>
      )}
    </div>
  )
}

function productLabel(lot: Lot): string {
  const type = lot.display_type ?? lot.product_type
  return type ? cap(type) : '—'
}

/** "Sparkling · Crown cap" - whichever of the two the lot has set. */
function productDetail(lot: Lot): string {
  const parts = []
  if (lot.sparkling != null) parts.push(lot.sparkling ? 'Sparkling' : 'Still')
  if (lot.closure) parts.push(cap(lot.closure.replace(/_/g, ' ')))
  return parts.join(' · ')
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={`skeleton ${styles.headSkeleton}`} />
      <div className={`skeleton ${styles.tableSkeleton}`} />
    </div>
  )
}
