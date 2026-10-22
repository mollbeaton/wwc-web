import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  customersApi,
  locationsApi,
  type CloseOutBody,
  type CloseOutResult,
} from '../../api/catalog'
import { stockApi, type StockRow, type WriteOffReason } from '../../api/stock'
import { BackLink } from '../../components/BackLink'
import { PageHeader } from '../../components/PageHeader'
import { gbp } from '../../lib/format'
import { errorText, money, nowIso, positiveInt, WRITE_OFF_REASONS } from '../../lib/stock'
import { explainDifference } from './closeOut'
import styles from './Stock.module.css'

/** How long typing has to pause before the preview is asked for again. */
export const PREVIEW_DEBOUNCE_MS = 400

const LOT_GRID = 'minmax(160px, 1.5fr) minmax(110px, 1fr) 90px 120px'
const RECON_GRID = 'minmax(160px, 1.6fr) 80px 90px 90px 70px 90px 100px'

interface WriteOffDraft {
  key: string
  productId: string
  qty: string
  reason: WriteOffReason | ''
  note: string
}

const blankWriteOff = (): WriteOffDraft => ({ key: crypto.randomUUID(), productId: '', qty: '1', reason: '', note: '' })

/** `value`, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

/** Close out an event. Events record takings, not products, so the stock is
 *  counted: what went out, what came back, what was opened or given away.
 *  The rest is booked as one sale whose total is the takings. */
export function CloseOutPage() {
  const { locationId = '' } = useParams()
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })
  const customers = useQuery({ queryKey: ['customers'], queryFn: customersApi.list })
  // Kept once the close-out posts: the event closes and its stock moves, so
  // the form underneath would no longer make sense.
  const [result, setResult] = useState<CloseOutResult | null>(null)

  const location = locations.data?.find((l) => l.id === locationId)
  const back = <BackLink fallbackTo="/stock/events" fallbackLabel="Events" />

  if (result) {
    return (
      <div>
        {back}
        <PageHeader title={`${location?.name ?? 'Event'} closed out`} />
        <div className="card" role="status">
          <p style={{ marginTop: 0 }}>
            Takings of <span className="mono">{gbp(result.takings)}</span> booked against an expected{' '}
            <span className="mono">{gbp(result.expected_takings)}</span>. Returned stock is back in the cellar.
          </p>
          <Link to={`/sales/${result.sale_id}`} className="btn btn--primary">
            View the sale
          </Link>
        </div>
      </div>
    )
  }

  if (locations.isPending || stock.isPending || customers.isPending) {
    return (
      <div aria-busy="true">
        {back}
        <p className="muted">Loading…</p>
      </div>
    )
  }
  const loadError = locations.error ?? stock.error ?? customers.error
  if (loadError) {
    return (
      <div>
        {back}
        <p className={styles.error}>{errorText(loadError, 'Couldn’t load the event.')}</p>
      </div>
    )
  }
  if (!location || location.kind !== 'event') {
    return (
      <div>
        {back}
        <p className={styles.error}>That isn’t an event location.</p>
      </div>
    )
  }
  if (location.status !== 'active') {
    return (
      <div>
        {back}
        <PageHeader title={location.name} />
        <div className="card muted">This event is already closed.</div>
      </div>
    )
  }

  return (
    <div>
      {back}
      <PageHeader title={`Close out ${location.name}`} subtitle="Count what came back, record what was given away, enter the takings" />
      <CloseOutForm
        locationId={locationId}
        stock={stock.data!}
        customers={customers.data!}
        onPosted={setResult}
      />
    </div>
  )
}

function CloseOutForm({
  locationId,
  stock,
  customers,
  onPosted,
}: {
  locationId: string
  stock: StockRow[]
  customers: Awaited<ReturnType<typeof customersApi.list>>
  onPosted: (result: CloseOutResult) => void
}) {
  const queryClient = useQueryClient()
  const eventCustomers = customers.filter((c) => c.kind === 'event')
  const [customerId, setCustomerId] = useState(eventCustomers[0]?.id ?? customers[0]?.id ?? '')
  const [returned, setReturned] = useState<Record<string, string>>({})
  const [writeOffs, setWriteOffs] = useState<WriteOffDraft[]>([])
  const [takings, setTakings] = useState('')
  // One id for the life of the page: posting again after a failure resends
  // it, so the event can't be closed out (and invoiced) twice.
  const [id] = useState(() => crypto.randomUUID())

  const lots = stock.flatMap((row) =>
    row.lots
      .filter((l) => l.location_id === locationId && l.qty > 0)
      .map((l) => ({ ...l, product_id: row.product_id, product_code: row.code, product_name: row.name })),
  )
  // Write-offs can only be of products that went to the event.
  const productOptions = stock.filter((r) => lots.some((l) => l.product_id === r.product_id))

  // Counts: a blank "came back" means none did, which is what the API assumes
  // for a lot left out, so only filled-in lots are sent.
  const countErrors = lots.filter((l) => {
    const raw = (returned[l.lot_id] ?? '').trim()
    if (raw === '') return false
    const n = Number(raw)
    return !Number.isInteger(n) || n < 0 || n > l.qty
  })
  const counts = lots
    .filter((l) => (returned[l.lot_id] ?? '').trim() !== '')
    .map((l) => ({ lot_id: l.lot_id, returned: Number(returned[l.lot_id]) }))
  const completeWriteOffs = writeOffs.filter((w) => w.productId && positiveInt(w.qty) != null && w.reason)
  const takingsValue = money(takings)

  const body: CloseOutBody = {
    customer_id: customerId,
    takings: takingsValue ?? '0.00',
    counts: countErrors.length ? [] : counts,
    write_offs: completeWriteOffs.map((w) => ({
      product_id: w.productId,
      qty: positiveInt(w.qty)!,
      reason: w.reason as WriteOffReason,
      ...(w.note.trim() ? { note: w.note.trim() } : {}),
    })),
  }
  const debounced = useDebounced(JSON.stringify(body), PREVIEW_DEBOUNCE_MS)

  const preview = useQuery({
    queryKey: ['close-out-preview', locationId, debounced],
    queryFn: ({ signal }) => locationsApi.closeOutPreview(locationId, JSON.parse(debounced) as CloseOutBody, signal),
    enabled: !!customerId && countErrors.length === 0,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: Infinity,
  })

  const post = useMutation({
    mutationFn: () => locationsApi.closeOut(locationId, { ...body, id, occurred_at: nowIso() }),
    onSuccess: async (r) => {
      await Promise.all(
        [['stock'], ['locations'], ['sales'], ['xero']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      onPosted(r)
    },
  })

  const writeOffsValid = writeOffs.every((w) => w.productId && positiveInt(w.qty) != null && w.reason)
  const valid = !!customerId && takingsValue != null && countErrors.length === 0 && writeOffsValid
  const updateWriteOff = (key: string, patch: Partial<WriteOffDraft>) =>
    setWriteOffs((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)))
  const p = preview.data

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>
              Stock at the event <span className={styles.count}>{lots.length}</span>
            </h2>
            <p className={styles.note}>Leave “Came back” blank if none of a lot came back.</p>
          </div>
        </div>
        {lots.length === 0 ? (
          <div className="card muted">Nothing was sent to this event.</div>
        ) : (
          <div className="card card--flush">
            <div className={styles.scroll} role="table" aria-label="Stock at the event">
              <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: LOT_GRID }} role="row">
                <span role="columnheader">Product</span>
                <span role="columnheader">Lot</span>
                <span role="columnheader" className={styles.num}>Went out</span>
                <span role="columnheader">Came back</span>
              </div>
              {lots.map((l) => (
                <div key={l.lot_id} className={styles.row} style={{ gridTemplateColumns: LOT_GRID }} role="row">
                  <span role="cell" className={styles.cell}>
                    <span className="mono">{l.product_code}</span>
                    <span className={styles.sub}>{l.product_name}</span>
                  </span>
                  <span role="cell">
                    <Link to={`/lots/${l.lot_id}`} className="mono text-link">
                      {l.lot_code}
                    </Link>
                  </span>
                  <span role="cell" className={`mono ${styles.num}`}>{l.qty}</span>
                  <span role="cell">
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      max={l.qty}
                      step="1"
                      placeholder="0"
                      aria-label={`Came back ${l.product_code} ${l.lot_code}`}
                      value={returned[l.lot_id] ?? ''}
                      onChange={(e) => setReturned({ ...returned, [l.lot_id]: e.target.value })}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {countErrors.length > 0 && (
          <p className={styles.error} style={{ marginTop: 8 }}>
            “Came back” must be a whole number no more than went out ({countErrors.map((l) => l.lot_code).join(', ')}).
          </p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>
              Written off <span className={styles.count}>{writeOffs.length}</span>
            </h2>
            <p className={styles.note}>Opened for tasting, given away, broken or drunk by staff - not sold.</p>
          </div>
          <button type="button" className="btn" onClick={() => setWriteOffs((ws) => [...ws, blankWriteOff()])}>
            <IconPlus size={16} stroke={2} /> Add write-off
          </button>
        </div>
        {writeOffs.length > 0 && (
          <div className="card" style={{ paddingTop: 6, paddingBottom: 10 }}>
            {writeOffs.map((w, i) => (
              <div key={w.key} className={styles.writeOffRow} role="group" aria-label={`Write-off ${i + 1}`}>
                <label className={styles.field}>
                  <span>Product</span>
                  <select value={w.productId} onChange={(e) => updateWriteOff(w.key, { productId: e.target.value })}>
                    <option value="">Choose…</option>
                    {productOptions.map((r) => (
                      <option key={r.product_id} value={r.product_id}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Qty</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={w.qty}
                    onChange={(e) => updateWriteOff(w.key, { qty: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>Reason</span>
                  <select
                    value={w.reason}
                    onChange={(e) => updateWriteOff(w.key, { reason: e.target.value as WriteOffReason })}
                    title={WRITE_OFF_REASONS.find((r) => r.value === w.reason)?.hint}
                  >
                    <option value="">Choose…</option>
                    {WRITE_OFF_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Note</span>
                  <input value={w.note} onChange={(e) => updateWriteOff(w.key, { note: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="text-link"
                  aria-label={`Remove write-off ${i + 1}`}
                  style={{ paddingBottom: 10 }}
                  onClick={() => setWriteOffs((ws) => ws.filter((x) => x.key !== w.key))}
                >
                  <IconTrash size={15} stroke={1.9} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Takings</h2>
        </div>
        <div className="card">
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Takings (£, ex VAT)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={takings}
                onChange={(e) => setTakings(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Book the sale to</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Reconciliation">
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>Reconciliation</h2>
            <p className={styles.note}>Sold = went out − came back − written off, at the customer’s list price.</p>
          </div>
          {preview.isFetching && <span className="muted">Updating…</span>}
        </div>
        {preview.error && (
          <p className={styles.error} role="alert" style={{ marginBottom: 10 }}>
            {errorText(preview.error, 'Couldn’t work out the preview.')}
          </p>
        )}
        {p && (
          <>
            <div className="card card--flush" style={{ marginBottom: 16 }}>
              <div className={styles.scroll} role="table" aria-label="Reconciliation by product">
                <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: RECON_GRID }} role="row">
                  <span role="columnheader">Product</span>
                  <span role="columnheader" className={styles.num}>Went out</span>
                  <span role="columnheader" className={styles.num}>Came back</span>
                  <span role="columnheader" className={styles.num}>Written off</span>
                  <span role="columnheader" className={styles.num}>Sold</span>
                  <span role="columnheader" className={styles.num}>List price</span>
                  <span role="columnheader" className={styles.num}>Value</span>
                </div>
                {p.lines.map((l) => (
                  <div key={l.product_id} className={styles.row} style={{ gridTemplateColumns: RECON_GRID }} role="row">
                    <span role="cell" className={styles.cell}>
                      <span className="mono">{l.code}</span>
                      <span className={styles.sub}>{l.name}</span>
                    </span>
                    <span role="cell" className={`mono ${styles.num}`}>{l.at_event}</span>
                    <span role="cell" className={`mono ${styles.num}`}>{l.returned}</span>
                    <span role="cell" className={`mono ${styles.num}`}>{l.written_off}</span>
                    <span role="cell" className={`mono ${styles.num} ${styles.strong}`}>{l.sold}</span>
                    <span role="cell" className={`mono ${styles.num}`}>{gbp(l.unit_price)}</span>
                    <span role="cell" className={`mono ${styles.num}`}>{gbp(l.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className={styles.summaryRow}>
                <span>Expected takings (list price)</span>
                <span className="mono" aria-label="Expected takings">{gbp(p.expected_takings)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Actual takings</span>
                <span className="mono">{takingsValue != null ? gbp(p.takings) : '—'}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.strong}`}>
                <span>Difference</span>
                <span
                  className={`mono ${Number(p.difference) < 0 ? styles.negative : Number(p.difference) > 0 ? styles.positive : ''}`}
                  aria-label="Difference"
                >
                  {takingsValue != null ? gbp(p.difference) : '—'}
                </span>
              </div>
              {takingsValue != null && <p className={styles.explain}>{explainDifference(p.difference, p.lines, stock)}</p>}
            </div>
          </>
        )}
      </section>

      {post.error && (
        <p className={styles.error} role="alert" style={{ marginBottom: 12 }}>
          {errorText(post.error, 'Could not post the close-out')}
        </p>
      )}
      <div className={styles.cellActions} style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <button type="button" className="btn btn--primary" onClick={() => post.mutate()} disabled={!valid || post.isPending}>
          {post.isPending ? 'Posting…' : 'Post close-out'}
        </button>
        <span className="muted">Moves what came back to the cellar, books the sale and closes the event.</span>
      </div>
    </>
  )
}
