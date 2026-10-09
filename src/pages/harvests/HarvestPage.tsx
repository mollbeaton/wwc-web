import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { harvestsApi, orchardsApi } from '../../api/harvests'
import { traceApi } from '../../api/trace'
import { BackLink } from '../../components/BackLink'
import { RecallSummary } from '../../components/trace/RecallSummary'
import { TraceDiagram } from '../../components/trace/TraceDiagram'
import { cap, fixed, shortDate } from '../../lib/format'
import styles from './HarvestPage.module.css'
import lotStyles from '../lots/LotPage.module.css'

export function HarvestPage() {
  const { harvestId = '' } = useParams()
  const harvest = useQuery({
    queryKey: ['harvest', harvestId],
    queryFn: () => harvestsApi.get(harvestId),
  })
  const orchards = useQuery({ queryKey: ['orchards'], queryFn: orchardsApi.list })
  const graph = useQuery({
    queryKey: ['harvest', harvestId, 'trace-graph'],
    queryFn: () => traceApi.harvest(harvestId),
  })

  if (harvest.isLoading) return <p className={lotStyles.muted}>Loading…</p>
  if (harvest.error || !harvest.data) {
    return (
      <p className={lotStyles.error}>
        {harvest.error instanceof ApiError ? harvest.error.message : 'Could not load the harvest'}
      </p>
    )
  }

  const h = harvest.data
  const orchardName =
    (orchards.data ?? []).find((o) => o.id === h.orchard_id)?.name ?? 'Orchard'
  const totalKg = h.varieties.reduce((sum, v) => sum + (v.weight_kg ? Number(v.weight_kg) : 0), 0)

  return (
    <div>
      <BackLink fallbackTo="/trace" fallbackLabel="Trace" />

      <div className={lotStyles.header}>
        <div className={lotStyles.headerMain}>
          <h1 className={`mono ${lotStyles.code}`}>{h.code}</h1>
          <span className={lotStyles.name}>{orchardName}</span>
        </div>
        <div className={lotStyles.headerMeta}>
          <span className="pill pill--grey">{cap(h.fruit)}</span>
        </div>
      </div>

      <div className={lotStyles.facts}>
        <Fact label="Harvested" value={shortDate(h.harvested_on)} />
        <Fact label="Orchard" value={orchardName} />
        <Fact label="Total weight" value={totalKg > 0 ? `${totalKg} kg` : 'Not weighed'} mono />
        <Fact label="Varieties" value={String(h.varieties.length)} />
      </div>

      <div className={`card ${styles.section}`}>
        <h2 className={lotStyles.sectionTitle}>Varieties</h2>
        {h.varieties.map((v, i) => (
          <div key={i} className={styles.varietyRow}>
            <span className={styles.varietyName}>{v.variety}</span>
            <span className="mono">{v.weight_kg ? `${fixed(v.weight_kg, 0)} kg` : 'Not weighed'}</span>
          </div>
        ))}
      </div>

      <div className={`card ${styles.section}`}>
        <h2 className={lotStyles.sectionTitle}>Where it went</h2>
        {graph.isError ? (
          <p className={lotStyles.error}>
            Couldn’t load the trace.{' '}
            <button type="button" className="text-link" onClick={() => void graph.refetch()}>
              Retry
            </button>
          </p>
        ) : !graph.data ? (
          <p className={lotStyles.muted}>Loading…</p>
        ) : graph.data.nodes.length <= 1 ? (
          <p className={lotStyles.muted}>Nothing has been traced forward from this harvest yet.</p>
        ) : (
          <TraceDiagram graph={graph.data} />
        )}
      </div>

      {graph.data && graph.data.nodes.length > 1 && (
        <RecallSummary title="Where this fruit is now" lines={graph.data.recall_family} />
      )}
    </div>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={lotStyles.fact}>
      <div className={lotStyles.factLabel}>{label}</div>
      <div className={`${mono ? 'mono ' : ''}${lotStyles.factValue}`}>{value}</div>
    </div>
  )
}
