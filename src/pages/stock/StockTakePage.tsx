import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { locationsApi } from '../../api/catalog'
import { stockApi, type StockRow, type StockTakeResult } from '../../api/stock'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageHeader } from '../../components/PageHeader'
import { errorText, nowIso, signed } from '../../lib/stock'
import styles from './Stock.module.css'

const GRID = 'minmax(160px, 1.4fr) minmax(120px, 1fr) 90px 110px 80px'

interface CountLine {
  product_id: string
  product_code: string
  product_name: string
  lot_id: string
  lot_code: string
  expected: number
}

/** Every lot of every product the API says is at a location. */
function linesAt(stock: StockRow[], locationId: string): CountLine[] {
  return stock.flatMap((row) =>
    row.lots
      .filter((l) => l.location_id === locationId)
      .map((l) => ({
        product_id: row.product_id,
        product_code: row.code,
        product_name: row.name,
        lot_id: l.lot_id,
        lot_code: l.lot_code,
        expected: l.qty,
      })),
  )
}

const keyOf = (l: { product_id: string; lot_id: string }) => `${l.product_id}:${l.lot_id}`

/** Count a location: enter what's actually on the shelf against what the
 *  system expects, review the variances, then post them as adjustments. */
export function StockTakePage() {
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const [locationId, setLocationId] = useState('')
  // Bumped after a posted take, so the next count starts clean with a new id.
  const [takeKey, setTakeKey] = useState(0)
  const [result, setResult] = useState<StockTakeResult | null>(null)

  const active = (locations.data ?? []).filter((l) => l.status === 'active')

  return (
    <div>
      <PageHeader title="Stock take" subtitle="Count a location and post the differences" />

      <div className={styles.toolbar}>
        <label className={styles.field} style={{ minWidth: 240 }}>
          <span>Location</span>
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setResult(null)
            }}
          >
            <option value="">Choose a location…</option>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {result && <TakeResult result={result} stock={stock.data ?? []} />}

      {stock.isError && <p className={styles.error}>{errorText(stock.error, 'Couldn’t load stock.')}</p>}
      {locationId && stock.data && (
        <CountSheet
          key={`${locationId}-${takeKey}`}
          locationId={locationId}
          locationName={active.find((l) => l.id === locationId)?.name ?? ''}
          lines={linesAt(stock.data, locationId)}
          onPosted={(r) => {
            setResult(r)
            setTakeKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function CountSheet({
  locationId,
  locationName,
  lines,
  onPosted,
}: {
  locationId: string
  locationName: string
  lines: CountLine[]
  onPosted: (result: StockTakeResult) => void
}) {
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState(false)
  // One id for this count: posting again after a failure resends it.
  const [id] = useState(() => crypto.randomUUID())

  const counted = lines
    .map((l) => ({ ...l, raw: counts[keyOf(l)] ?? '' }))
    .filter((l) => l.raw.trim() !== '')
    .map((l) => ({ ...l, counted: Number(l.raw) }))
  const invalid = counted.some((l) => !Number.isInteger(l.counted) || l.counted < 0)
  const variances = counted.filter((l) => l.counted !== l.expected)

  const post = useMutation({
    mutationFn: () =>
      stockApi.take({
        id,
        location_id: locationId,
        occurred_at: nowIso(),
        counts: counted.map((l) => ({ product_id: l.product_id, lot_id: l.lot_id, counted: l.counted })),
      }),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] })
      setReviewing(false)
      onPosted(r)
    },
  })

  if (lines.length === 0) {
    return <div className="card muted">Nothing is recorded at {locationName}.</div>
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            {locationName} <span className={styles.count}>{lines.length}</span>
          </h2>
          <p className={styles.note}>Leave a lot blank to skip it - only the lots you count are adjusted.</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => {
            post.reset()
            setReviewing(true)
          }}
          disabled={counted.length === 0 || invalid}
        >
          Review variances
        </button>
      </div>
      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Count sheet">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader">Lot</span>
            <span role="columnheader" className={styles.num}>Expected</span>
            <span role="columnheader">Counted</span>
            <span role="columnheader" className={styles.num}>Variance</span>
          </div>
          {lines.map((l) => {
            const raw = counts[keyOf(l)] ?? ''
            const delta = raw.trim() === '' ? null : Number(raw) - l.expected
            return (
              <div key={keyOf(l)} className={styles.row} style={{ gridTemplateColumns: GRID }} role="row">
                <span role="cell" className={styles.cell}>
                  <span className="mono">{l.product_code}</span>
                  <span className={styles.sub}>{l.product_name}</span>
                </span>
                <span role="cell">
                  <Link to={`/lots/${l.lot_id}`} className="mono text-link">
                    {l.lot_code}
                  </Link>
                </span>
                <span role="cell" className={`mono ${styles.num}`}>{l.expected}</span>
                <span role="cell">
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="1"
                    value={raw}
                    aria-label={`Counted ${l.product_code} ${l.lot_code}`}
                    onChange={(e) => setCounts({ ...counts, [keyOf(l)]: e.target.value })}
                  />
                </span>
                <span
                  role="cell"
                  className={`mono ${styles.num} ${delta == null || delta === 0 ? '' : delta < 0 ? styles.negative : styles.positive}`}
                >
                  {delta == null || Number.isNaN(delta) ? '—' : signed(delta)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {reviewing && (
        <ConfirmDialog
          title={`Post stock take for ${locationName}?`}
          confirmLabel="Post stock take"
          pendingLabel="Posting…"
          pending={post.isPending}
          error={post.error ? errorText(post.error, 'Could not post the stock take') : null}
          onConfirm={() => post.mutate()}
          onCancel={() => setReviewing(false)}
        >
          <p>
            {counted.length} {counted.length === 1 ? 'lot' : 'lots'} counted,{' '}
            {variances.length === 0 ? 'all matching.' : `${variances.length} with a variance:`}
          </p>
          {variances.map((v) => (
            <div key={keyOf(v)} className={styles.miniRow} style={{ gridTemplateColumns: '1fr 1fr 60px' }}>
              <span className="mono">{v.product_code}</span>
              <span className="mono">{v.lot_code}</span>
              <span className={`mono ${styles.num} ${v.counted < v.expected ? styles.negative : styles.positive}`}>
                {signed(v.counted - v.expected)}
              </span>
            </div>
          ))}
        </ConfirmDialog>
      )}
    </section>
  )
}

function TakeResult({ result, stock }: { result: StockTakeResult; stock: StockRow[] }) {
  const changed = result.adjustments.filter((a) => a.delta !== 0)
  const code = (productId: string) => stock.find((r) => r.product_id === productId)?.code ?? productId
  return (
    <div className="card" role="status" style={{ marginBottom: 22 }}>
      <h2 className={styles.cardTitle}>Stock take posted</h2>
      {changed.length === 0 ? (
        <p className="muted">Every count matched - nothing adjusted.</p>
      ) : (
        changed.map((a) => (
          <div key={keyOf(a)} className={styles.miniRow} style={{ gridTemplateColumns: '1fr 120px 60px' }}>
            <span className="mono">{code(a.product_id)}</span>
            <span className="muted">
              {a.expected} → {a.counted}
            </span>
            <span className={`mono ${styles.num} ${a.delta < 0 ? styles.negative : styles.positive}`}>
              {signed(a.delta)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
