import { useQuery } from '@tanstack/react-query'
import { lotsApi } from '../../api/lots'
import { traceApi } from '../../api/trace'
import { DownloadButton } from '../../components/DownloadButton'
import { RecallSummary } from '../../components/trace/RecallSummary'
import { TraceDiagram } from '../../components/trace/TraceDiagram'
import { fixed, shortDate } from '../../lib/format'
import styles from './LotPage.module.css'

/** Two-way traceability for a lot: the lineage diagram (back to the fruit,
 *  forward to where it went, and everything else sharing its fruit), where
 *  the product is now, then the detail - fruit composition, bought-in juice
 *  and additions. */
export function TraceTab({ lotId }: { lotId: string }) {
  const graph = useQuery({ queryKey: ['lot', lotId, 'trace-graph'], queryFn: () => traceApi.lot(lotId) })
  const backward = useQuery({
    queryKey: ['lot', lotId, 'backward'],
    queryFn: () => lotsApi.backwardTrace(lotId),
  })

  if (graph.isError || backward.isError) {
    return (
      <p className={styles.error}>
        Couldn’t load the trace.{' '}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            void graph.refetch()
            void backward.refetch()
          }}
        >
          Retry
        </button>
      </p>
    )
  }
  if (!graph.data || !backward.data) return <p className={styles.muted}>Loading…</p>
  const trace = backward.data
  const code = graph.data.nodes.find((n) => n.role === 'focus')?.title ?? lotId

  return (
    <div className={styles.tabBody}>
      <div className={styles.traceActions}>
        <DownloadButton path={`/lots/${lotId}/trace/backward/csv`} filename={`trace-back-${code}.csv`}>
          Backward CSV
        </DownloadButton>
        <DownloadButton path={`/lots/${lotId}/trace/forward/csv`} filename={`trace-forward-${code}.csv`}>
          Forward CSV
        </DownloadButton>
        <DownloadButton path={`/lots/${lotId}/trace/report.pdf`} filename={`trace-${code}.pdf`} primary>
          PDF report
        </DownloadButton>
      </div>

      <div className="card">
        <h2 className={styles.sectionTitle}>Lineage</h2>
        <TraceDiagram graph={graph.data} />
      </div>

      <RecallSummary
        title="Where this lot is now (and what came from it)"
        lines={graph.data.recall_direct}
      />
      <RecallSummary title="Everything sharing its fruit" lines={graph.data.recall_family} />

      <div className="card">
        <h2 className={styles.sectionTitle}>Where the fruit came from</h2>
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
          <h2 className={styles.sectionTitle}>Bought-in juice</h2>
          {trace.intake_suppliers.map((s, i) => (
            <div key={i} className={styles.supplier}>
              {s}
            </div>
          ))}
        </div>
      )}

      {trace.additions.length > 0 && (
        <div className="card">
          <h2 className={styles.sectionTitle}>Additions</h2>
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
    </div>
  )
}
