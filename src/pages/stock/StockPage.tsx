import { useQuery } from '@tanstack/react-query'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { stockApi, type StockRow } from '../../api/stock'
import { useAuth } from '../../auth/AuthContext'
import { canSell } from '../../auth/roles'
import { PageHeader } from '../../components/PageHeader'
import { lotKindLabel, shortDate } from '../../lib/format'
import { dateTime, errorText, movementText, signed } from '../../lib/stock'
import { WriteOffModal } from './WriteOffModal'
import { SyncBadge } from './SyncBadge'
import styles from './Stock.module.css'

const GRID = 'minmax(180px, 1.6fr) 110px 80px minmax(160px, 1.6fr) 80px 110px'

/** Finished stock: one row per product, what's on hand and where, and whether
 *  Xero agrees. Expanding a product shows its lots and movement history. */
export function StockPage() {
  const { effectiveRole } = useAuth()
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [writingOff, setWritingOff] = useState(false)

  const rows = stock.data ?? []
  const totalUnits = rows.reduce((sum, r) => sum + r.on_hand, 0)

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Finished stock on hand, where it is, and what Xero holds"
        actions={
          canSell(effectiveRole) && (
            <button className="btn" onClick={() => setWritingOff(true)} disabled={rows.length === 0}>
              Write off
            </button>
          )
        }
      />

      {stock.isPending && (
        <div aria-busy="true" aria-label="Loading">
          <div className={`skeleton ${styles.tableSkeleton}`} />
        </div>
      )}
      {stock.isError && (
        <p className="muted">
          {errorText(stock.error, 'Couldn’t load stock.')}{' '}
          <button type="button" className="text-link" onClick={() => stock.refetch()}>
            Retry
          </button>
        </p>
      )}

      {stock.data && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>
                Products <span className={styles.count}>{rows.length}</span>
              </h2>
              <p className={styles.note}>{totalUnits} units on hand across every location.</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="card muted">No active products yet. Add them under Manage → Products.</div>
          ) : (
            <div className="card card--flush">
              <div className={styles.scroll} role="table" aria-label="Stock">
                <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
                  <span role="columnheader">Product</span>
                  <span role="columnheader">Format</span>
                  <span role="columnheader" className={styles.num}>On hand</span>
                  <span role="columnheader">By location</span>
                  <span role="columnheader" className={styles.num}>Xero</span>
                  <span role="columnheader">Sync</span>
                </div>
                {rows.map((row) => (
                  <ProductRow
                    key={row.product_id}
                    row={row}
                    open={expanded === row.product_id}
                    onToggle={() => setExpanded(expanded === row.product_id ? null : row.product_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {writingOff && <WriteOffModal stock={rows} onClose={() => setWritingOff(false)} />}
    </div>
  )
}

function ProductRow({ row, open, onToggle }: { row: StockRow; open: boolean; onToggle: () => void }) {
  const Chevron = open ? IconChevronDown : IconChevronRight
  return (
    <>
      <button
        type="button"
        role="row"
        aria-expanded={open}
        className={`${styles.row} ${styles.rowButton} ${open ? styles.expanded : ''}`}
        style={{ gridTemplateColumns: GRID }}
        onClick={onToggle}
      >
        <span role="cell" className={styles.chevron}>
          <Chevron size={16} stroke={2} />
          <span className={styles.cell}>
            <span className={`mono ${styles.strong}`}>{row.code}</span>
            <span className={styles.sub}>{row.name}</span>
          </span>
        </span>
        <span role="cell">
          {lotKindLabel(row.kind)}
          <span className={`mono ${styles.sub}`}>{row.unit_volume_l} L</span>
        </span>
        <span role="cell" className={`mono ${styles.num} ${styles.strong}`}>{row.on_hand}</span>
        <span role="cell" className={styles.chips}>
          {row.by_location.length === 0 && <span className="muted">—</span>}
          {row.by_location.map((l) => (
            <span key={l.location_id} className={styles.chip}>
              {l.location_name} <span className="mono">{l.qty}</span>
            </span>
          ))}
        </span>
        <span role="cell" className={`mono ${styles.num}`}>{row.xero_qty ?? '—'}</span>
        <span role="cell">
          <SyncBadge state={row.sync_state} drift={row.drift} />
        </span>
      </button>
      {open && <ProductDetail row={row} />}
    </>
  )
}

function ProductDetail({ row }: { row: StockRow }) {
  const movements = useQuery({
    queryKey: ['stock', 'movements', { product_id: row.product_id }],
    queryFn: () => stockApi.movements({ product_id: row.product_id, limit: 50 }),
  })

  return (
    <div className={styles.detail}>
      <div>
        <h3 className={styles.detailTitle}>Lots</h3>
        {row.lots.length === 0 && <p className="muted">None in stock.</p>}
        {row.lots.map((lot) => (
          <div
            key={`${lot.lot_id}-${lot.location_id}`}
            className={styles.miniRow}
            style={{ gridTemplateColumns: '1fr 1fr 90px 50px' }}
          >
            <Link to={`/lots/${lot.lot_id}`} className="mono text-link">
              {lot.lot_code}
            </Link>
            <span>{lot.location_name}</span>
            <span className="muted">{lot.released_at ? shortDate(lot.released_at) : '—'}</span>
            <span className={`mono ${styles.num}`}>{lot.qty}</span>
          </div>
        ))}
      </div>
      <div>
        <h3 className={styles.detailTitle}>Movements</h3>
        {movements.isPending && <p className="muted">Loading…</p>}
        {movements.isError && <p className={styles.error}>{errorText(movements.error, 'Couldn’t load movements.')}</p>}
        {movements.data?.length === 0 && <p className="muted">No movements yet.</p>}
        {movements.data?.map((m) => (
          <div key={m.id} className={styles.miniRow} style={{ gridTemplateColumns: '100px 1fr 1fr 50px' }}>
            <span className="muted">{dateTime(m.occurred_at)}</span>
            <span className={styles.cell}>
              {movementText(m)}
              <span className={styles.sub}>
                {m.sale_id ? (
                  <Link to={`/sales/${m.sale_id}`} className="text-link">
                    {m.sale_reference}
                  </Link>
                ) : (
                  (m.note ?? m.recorded_by_email ?? '')
                )}
              </span>
            </span>
            <span className={styles.cell}>
              {m.location_name}
              {m.lot_code && <span className={`mono ${styles.sub}`}>{m.lot_code}</span>}
            </span>
            <span className={`mono ${styles.num} ${m.qty < 0 ? styles.negative : styles.positive}`}>
              {signed(m.qty)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
