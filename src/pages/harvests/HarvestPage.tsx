import { useQuery } from '@tanstack/react-query'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { harvestsApi, orchardsApi } from '../../api/harvests'
import type { ForwardTraceNode } from '../../api/lots'
import { fixed, shortDate } from '../../lib/format'
import styles from './HarvestPage.module.css'
import lotStyles from '../lots/LotPage.module.css'

function nodePill(node: ForwardTraceNode): { label: string; cls: string } {
  if (node.is_ready_for_sale) return { label: 'Ready for sale', cls: 'pill--green' }
  if (node.status === 'ended') return { label: 'Ended', cls: 'pill--grey' }
  if (node.kind !== 'tank') return { label: 'Packaged', cls: 'pill--dashed' }
  return { label: 'In vessel', cls: 'pill--blue' }
}

export function HarvestPage() {
  const { harvestId = '' } = useParams()
  const harvest = useQuery({
    queryKey: ['harvest', harvestId],
    queryFn: () => harvestsApi.get(harvestId),
  })
  const orchards = useQuery({ queryKey: ['orchards'], queryFn: orchardsApi.list })
  const forward = useQuery({
    queryKey: ['harvest', harvestId, 'forward'],
    queryFn: () => harvestsApi.forwardTrace(harvestId),
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
  const nodes = forward.data ?? []
  const ready = nodes.filter((n) => n.is_ready_for_sale).length
  const packagedNotReady = nodes.filter((n) => n.kind !== 'tank' && !n.is_ready_for_sale).length
  const inVessels = nodes.filter((n) => n.kind === 'tank' && n.status === 'active').length

  return (
    <div>
      <Link to="/trace" className={lotStyles.breadcrumb}>
        <IconArrowLeft size={16} stroke={1.9} />
        Back to Trace
      </Link>

      <div className={lotStyles.header}>
        <div className={lotStyles.headerMain}>
          <span className={`mono ${lotStyles.code}`}>{h.code}</span>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className={lotStyles.sectionTitle}>Varieties</h3>
        {h.varieties.map((v, i) => (
          <div key={i} className={styles.varietyRow}>
            <span className={styles.varietyName}>{v.variety}</span>
            <span className="mono">{v.weight_kg ? `${fixed(v.weight_kg, 0)} kg` : 'Not weighed'}</span>
          </div>
        ))}
      </div>

      <div className={lotStyles.recallCards}>
        <RecallCard label="Ready for sale" value={ready} tone="green" />
        <RecallCard label="Packaged, not ready" value={packagedNotReady} tone="amber" />
        <RecallCard label="Still in vessels" value={inVessels} tone="blue" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className={lotStyles.sectionTitle}>Where it went</h3>
        {nodes.length === 0 ? (
          <p className={lotStyles.muted}>Nothing has been traced forward from this harvest yet.</p>
        ) : (
          nodes.map((node) => {
            const pill = nodePill(node)
            return (
              <Link key={node.lot_id} to={`/lots/${node.lot_id}`} className={lotStyles.descendant}>
                <span className="mono">{node.code}</span>
                <span className={lotStyles.descKind}>{node.kind.replace(/_/g, ' ')}</span>
                <span className={`pill ${pill.cls}`}>{pill.label}</span>
              </Link>
            )
          })
        )}
      </div>
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
    <div className={`${lotStyles.recallCard} ${lotStyles[`recall_${tone}`]}`}>
      <div className={`mono ${lotStyles.recallValue}`}>{value}</div>
      <div className={lotStyles.recallLabel}>{label}</div>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
