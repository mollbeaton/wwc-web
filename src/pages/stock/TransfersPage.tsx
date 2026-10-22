import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { locationsApi, type StockLocation } from '../../api/catalog'
import { stockApi, type StockRow } from '../../api/stock'
import { useAuth } from '../../auth/AuthContext'
import { canSell } from '../../auth/roles'
import { PageHeader } from '../../components/PageHeader'
import { dateTime, errorText, movementLabel, nowIso, positiveInt, signed } from '../../lib/stock'
import { availableAt, locationsHolding, lotsAt } from './stockPicking'
import styles from './Stock.module.css'

const GRID = '120px 110px minmax(140px, 1fr) minmax(120px, 1fr) 70px minmax(120px, 1fr)'

/** Move stock between locations (cellar → shop, shop → an event), and the
 *  transfers recorded recently. */
export function TransfersPage() {
  const { effectiveRole } = useAuth()
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  // There's no type filter on movements, so fetch a generous page and keep the
  // transfer halves.
  const movements = useQuery({
    queryKey: ['stock', 'movements', { limit: 200 }],
    queryFn: () => stockApi.movements({ limit: 200 }),
  })
  // Bumped after each saved transfer so the form remounts with a fresh id.
  const [formKey, setFormKey] = useState(0)

  const transfers = (movements.data ?? []).filter((m) => m.type === 'transfer_out' || m.type === 'transfer_in')

  return (
    <div>
      <PageHeader title="Transfers" subtitle="Move stock between the cellar, the shop and events" />

      {canSell(effectiveRole) && stock.data && locations.data && (
        <section className={styles.section}>
          <TransferForm
            key={formKey}
            stock={stock.data}
            locations={locations.data.filter((l) => l.status === 'active')}
            onSaved={() => setFormKey((k) => k + 1)}
          />
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            Recent transfers <span className={styles.count}>{transfers.length}</span>
          </h2>
        </div>
        <div className="card card--flush">
          <div className={styles.scroll} role="table" aria-label="Recent transfers">
            <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
              <span role="columnheader">When</span>
              <span role="columnheader">Movement</span>
              <span role="columnheader">Product</span>
              <span role="columnheader">Location</span>
              <span role="columnheader" className={styles.num}>Units</span>
              <span role="columnheader">By</span>
            </div>
            {transfers.map((m) => (
              <div key={m.id} className={styles.row} style={{ gridTemplateColumns: GRID }} role="row">
                <span role="cell" className="muted">{dateTime(m.occurred_at)}</span>
                <span role="cell">{movementLabel(m.type)}</span>
                <span role="cell" className={styles.cell}>
                  <span className="mono">{m.product_code}</span>
                  {m.lot_id && (
                    <Link to={`/lots/${m.lot_id}`} className={`mono ${styles.sub}`}>
                      {m.lot_code}
                    </Link>
                  )}
                </span>
                <span role="cell">{m.location_name}</span>
                <span role="cell" className={`mono ${styles.num} ${m.qty < 0 ? styles.negative : styles.positive}`}>
                  {signed(m.qty)}
                </span>
                <span role="cell" className={styles.sub}>{m.recorded_by_email ?? '—'}</span>
              </div>
            ))}
            {movements.isPending && <p className={styles.empty}>Loading…</p>}
            {movements.isError && <p className={styles.empty}>{errorText(movements.error, 'Couldn’t load.')}</p>}
            {movements.data && transfers.length === 0 && <p className={styles.empty}>No transfers yet.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}

function TransferForm({
  stock,
  locations,
  onSaved,
}: {
  stock: StockRow[]
  locations: StockLocation[]
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const inStock = stock.filter((r) => r.on_hand > 0)
  const [productId, setProductId] = useState(inStock[0]?.product_id ?? '')
  const row = stock.find((r) => r.product_id === productId)
  const [fromId, setFromId] = useState(locationsHolding(row)[0]?.location_id ?? '')
  const [toId, setToId] = useState('')
  const [lotId, setLotId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  // One id per transfer: a retried save resends it, so it can't move twice.
  const [id] = useState(() => crypto.randomUUID())

  const destinations = locations.filter((l) => l.id !== fromId)
  const available = availableAt(row, fromId, lotId)
  const units = positiveInt(qty)
  const valid = !!productId && !!fromId && !!toId && toId !== fromId && units != null && units <= available

  const save = useMutation({
    mutationFn: () =>
      stockApi.transfer({
        id,
        product_id: productId,
        lot_id: lotId || undefined,
        from_location_id: fromId,
        to_location_id: toId,
        qty: units!,
        occurred_at: nowIso(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] })
      onSaved()
    },
    onError: (e) => setError(errorText(e, 'Could not record the transfer')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  if (inStock.length === 0) return <div className="card muted">Nothing in stock to move.</div>

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit} aria-label="New transfer">
      <h2 className={styles.cardTitle}>New transfer</h2>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Product</span>
          <select
            value={productId}
            onChange={(e) => {
              const next = stock.find((r) => r.product_id === e.target.value)
              setProductId(e.target.value)
              setFromId(locationsHolding(next)[0]?.location_id ?? '')
              setLotId('')
            }}
          >
            {inStock.map((r) => (
              <option key={r.product_id} value={r.product_id}>
                {r.code} · {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>From</span>
          <select
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value)
              setLotId('')
              if (toId === e.target.value) setToId('')
            }}
          >
            {locationsHolding(row).map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.location_name} ({l.qty})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Lot</span>
          <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Oldest first</option>
            {lotsAt(row, fromId).map((l) => (
              <option key={l.lot_id} value={l.lot_id}>
                {l.lot_code} ({l.qty})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>To</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Choose…</option>
            {destinations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Units</span>
          <input type="number" min="1" step="1" max={available} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
      </div>
      {units != null && units > available && <p className={styles.error}>Only {available} there.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn--primary" disabled={!valid || save.isPending}>
          {save.isPending ? 'Moving…' : 'Move stock'}
        </button>
      </div>
    </form>
  )
}
