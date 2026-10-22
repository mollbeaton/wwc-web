import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { lotsApi } from '../../api/lots'
import { shortDate } from '../../lib/format'
import { errorText } from '../../lib/stock'
import stock from '../stock/Stock.module.css'
import styles from './LotPage.module.css'

const GRID = '130px minmax(140px, 1.5fr) 70px 100px 120px'

/** Who bought units of this lot - the list a recall works from. Returns show
 *  with a negative quantity. */
export function SoldToTab({ lotId }: { lotId: string }) {
  const soldTo = useQuery({ queryKey: ['lot', lotId, 'sold-to'], queryFn: () => lotsApi.soldTo(lotId) })

  if (soldTo.isError) return <p className={styles.error}>{errorText(soldTo.error, 'Couldn’t load sales.')}</p>
  if (!soldTo.data) return <p className={styles.muted}>Loading…</p>
  if (soldTo.data.length === 0) return <div className="card muted">None of this lot has been sold yet.</div>

  const net = soldTo.data.reduce((sum, s) => sum + s.qty, 0)

  return (
    <div className={styles.tabBody}>
      <div className="card card--flush">
        <div className={stock.scroll} role="table" aria-label="Sold to">
          <div className={`${stock.row} ${stock.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Reference</span>
            <span role="columnheader">Customer</span>
            <span role="columnheader" className={stock.num}>Units</span>
            <span role="columnheader">Date</span>
            <span role="columnheader">Invoice</span>
          </div>
          {soldTo.data.map((s, i) => (
            <div key={`${s.sale_id}-${i}`} className={stock.row} style={{ gridTemplateColumns: GRID }} role="row">
              <span role="cell" className={stock.cell}>
                <Link to={`/sales/${s.sale_id}`} className="mono text-link">
                  {s.reference}
                </Link>
                {s.kind === 'return' && <span className={stock.sub}>Return</span>}
              </span>
              <span role="cell">{s.customer_name}</span>
              <span role="cell" className={`mono ${stock.num}`}>{s.qty}</span>
              <span role="cell" className="muted">{shortDate(s.sold_at)}</span>
              <span role="cell" className="mono">{s.invoice_number ?? '—'}</span>
            </div>
          ))}
          <div className={`${stock.row} ${stock.strong}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="cell">Net sold</span>
            <span role="cell" />
            <span role="cell" className={`mono ${stock.num}`}>{net}</span>
            <span role="cell" />
            <span role="cell" />
          </div>
        </div>
      </div>
    </div>
  )
}
