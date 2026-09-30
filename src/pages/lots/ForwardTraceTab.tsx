import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { lotsApi, type ForwardTraceNode } from '../../api/lots'
import styles from './LotPage.module.css'

function nodePill(node: ForwardTraceNode): { label: string; cls: string } {
  if (node.is_ready_for_sale) return { label: 'Ready for sale', cls: 'pill--green' }
  if (node.status === 'ended') return { label: 'Ended', cls: 'pill--grey' }
  if (node.kind !== 'tank') return { label: 'Packaged', cls: 'pill--dashed' }
  return { label: 'In vessel', cls: 'pill--blue' }
}

export function ForwardTraceTab({ lotId }: { lotId: string }) {
  const query = useQuery({
    queryKey: ['lot', lotId, 'forward'],
    queryFn: () => lotsApi.forwardTrace(lotId),
  })

  if (!query.data) return <p className={styles.muted}>Loading…</p>
  const nodes = query.data

  const ready = nodes.filter((n) => n.is_ready_for_sale).length
  const packagedNotReady = nodes.filter((n) => n.kind !== 'tank' && !n.is_ready_for_sale).length
  const inVessels = nodes.filter((n) => n.kind === 'tank' && n.status === 'active').length

  return (
    <div className={styles.tabBody}>
      <div className={styles.recallCards}>
        <RecallCard label="Ready for sale" value={ready} tone="green" />
        <RecallCard label="Packaged, not ready" value={packagedNotReady} tone="amber" />
        <RecallCard label="Still in vessels" value={inVessels} tone="blue" />
      </div>

      <div className="card">
        <h3 className={styles.sectionTitle}>Descendants</h3>
        {nodes.length === 0 ? (
          <p className={styles.muted}>Nothing has come off this lot yet.</p>
        ) : (
          nodes.map((node) => {
            const pill = nodePill(node)
            return (
              <Link key={node.lot_id} to={`/lots/${node.lot_id}`} className={styles.descendant}>
                <span className="mono">{node.code}</span>
                <span className={styles.descKind}>{node.kind.replace(/_/g, ' ')}</span>
                <span className={`pill ${pill.cls}`}>{pill.label}</span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

function RecallCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'green' | 'amber' | 'blue'
}) {
  return (
    <div className={`${styles.recallCard} ${styles[`recall_${tone}`]}`}>
      <div className={`mono ${styles.recallValue}`}>{value}</div>
      <div className={styles.recallLabel}>{label}</div>
    </div>
  )
}
