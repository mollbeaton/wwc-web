import { useQuery } from '@tanstack/react-query'
import { IconDownload } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { downloadFile } from '../../api/client'
import { lotsApi } from '../../api/lots'
import { fixed, shortDate } from '../../lib/format'
import styles from './LotPage.module.css'

export function BackwardTraceTab({ lotId }: { lotId: string }) {
  const query = useQuery({
    queryKey: ['lot', lotId, 'backward'],
    queryFn: () => lotsApi.backwardTrace(lotId),
  })

  if (!query.data) return <p className={styles.muted}>Loading…</p>
  const trace = query.data

  return (
    <div className={styles.tabBody}>
      <div className={styles.traceActions}>
        <button
          className="btn"
          onClick={() =>
            void downloadFile(`/lots/${lotId}/trace/backward/csv`, `trace-back-${lotId}.csv`)
          }
        >
          <IconDownload size={16} stroke={1.8} /> Export CSV
        </button>
      </div>

      <div className="card">
        <h3 className={styles.sectionTitle}>Where the fruit came from</h3>
        {trace.composition.length === 0 ? (
          <p className={styles.muted}>
            No fruit composition recorded — the trace ends at a supplier.
          </p>
        ) : (
          <div>
            {trace.composition.map((c, i) => (
              <div className={styles.compRow} key={i}>
                <span className={styles.dotCider} />
                <div className={styles.compMain}>
                  <span className={styles.compVariety}>{c.variety}</span>
                  <span className={styles.compOrchard}>
                    {c.orchard_name} · {c.harvest_code} · {shortDate(c.harvested_on)}
                  </span>
                </div>
                <span className="mono">{fixed(c.volume_l, 1)} L</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {trace.intake_suppliers.length > 0 && (
        <div className="card">
          <h3 className={styles.sectionTitle}>Bought-in juice</h3>
          {trace.intake_suppliers.map((s, i) => (
            <div key={i} className={styles.supplier}>
              {s}
            </div>
          ))}
        </div>
      )}

      {trace.additions.length > 0 && (
        <div className="card">
          <h3 className={styles.sectionTitle}>Additions</h3>
          {trace.additions.map((a, i) => (
            <div key={i} className={styles.compRow}>
              <div className={styles.compMain}>
                <span className={styles.compVariety}>{a.kind}</span>
                <span className={styles.compOrchard}>{shortDate(a.occurred_at)}</span>
              </div>
              <span className="mono">
                {a.amount} {a.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {trace.ancestor_lot_ids.length > 0 && (
        <div className="card">
          <h3 className={styles.sectionTitle}>Parent lots</h3>
          <div className={styles.ancestors}>
            {trace.ancestor_lot_ids.map((id) => (
              <Link key={id} to={`/lots/${id}`} className={styles.ancestorLink}>
                View parent lot
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
