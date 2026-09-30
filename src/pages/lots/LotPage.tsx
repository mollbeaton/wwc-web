import { useQuery } from '@tanstack/react-query'
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { lotsApi, type Lot } from '../../api/lots'
import { vesselsApi } from '../../api/vessels'
import { Tabs, type TabDef } from '../../components/Tabs'
import { fixed } from '../../lib/format'
import { lotStatusPill } from '../../lib/lotStatus'
import { BackwardTraceTab } from './BackwardTraceTab'
import { ForwardTraceTab } from './ForwardTraceTab'
import { HistoryTab } from './HistoryTab'
import styles from './LotPage.module.css'

type LotTab = 'history' | 'backward' | 'forward'

const TABS: TabDef<LotTab>[] = [
  { value: 'history', label: 'History' },
  { value: 'backward', label: 'Backward trace' },
  { value: 'forward', label: 'Forward trace' },
]

export function LotPage() {
  const { lotId = '' } = useParams()
  const [tab, setTab] = useState<LotTab>('history')

  const vessels = useQuery({ queryKey: ['vessels'], queryFn: vesselsApi.list })
  const lotQuery = useQuery({ queryKey: ['lot', lotId], queryFn: () => lotsApi.get(lotId) })

  if (lotQuery.isLoading) return <p className={styles.muted}>Loading…</p>
  if (lotQuery.error || !lotQuery.data) {
    return (
      <p className={styles.error}>
        {lotQuery.error instanceof ApiError ? lotQuery.error.message : 'Could not load the lot'}
      </p>
    )
  }

  const lot = lotQuery.data
  const pill = lotStatusPill(lot)
  const vesselByID = new Map((vessels.data ?? []).map((v) => [v.id, v]))
  const vesselCodes = lot.current_vessel_ids
    .map((id) => vesselByID.get(id)?.code ?? '—')
    .join(', ')

  const abvOver85 = lot.abv != null && Number(lot.abv) >= 8.5
  const conditioningRisk =
    lot.kind !== 'tank' && lot.sparkling === true && lot.abv_method === 'calculated'

  return (
    <div>
      <Link to="/tanks" className={styles.breadcrumb}>
        <IconArrowLeft size={16} stroke={1.9} />
        Back
      </Link>

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={`mono ${styles.code}`}>{lot.code}</span>
          {lot.name && <span className={styles.name}>{lot.name}</span>}
        </div>
        <div className={styles.headerMeta}>
          {lot.product_type && <span className="pill pill--grey">{cap(lot.product_type)}</span>}
          <span className={`pill ${pill.cls}`}>{pill.label}</span>
          {lot.sparkling != null && (
            <span className="pill pill--grey">{lot.sparkling ? 'Sparkling' : 'Still'}</span>
          )}
        </div>
      </div>

      <div className={styles.facts}>
        {lot.kind === 'tank' ? (
          <>
            <Fact label="Volume" value={`${fixed(lot.current_volume_l, 0)} L`} mono />
            <Fact label="Vessel" value={vesselCodes || '—'} />
            <Fact label="ABV" value={abvText(lot)} sub={lot.abv_method ?? undefined} mono />
            <Fact label="Latest gravity" value={lot.latest_sg ?? '—'} mono />
          </>
        ) : (
          <>
            <Fact
              label="Units"
              value={
                lot.unit_count != null && lot.unit_volume_l != null
                  ? `${lot.unit_count} × ${lot.unit_volume_l} L`
                  : `${fixed(lot.current_volume_l, 0)} L`
              }
              mono
            />
            <Fact label="ABV" value={abvText(lot)} sub={lot.abv_method ?? undefined} mono />
            <Fact
              label="Type"
              value={lot.sparkling ? 'Sparkling' : 'Still'}
              sub={lot.closure ?? undefined}
            />
            <Fact label="Volume" value={`${fixed(lot.current_volume_l, 0)} L`} mono />
          </>
        )}
      </div>

      {(abvOver85 || conditioningRisk) && (
        <div className={styles.flags}>
          {abvOver85 && lot.product_type === 'cider' && (
            <Flag text="Cider at 8.5% ABV or over — no longer counts as cider for duty. Check before filing." />
          )}
          {conditioningRisk && (
            <Flag text="Bottle-conditioned sparkling lot with a calculated ABV only. Conditioning raises ABV after the last tank reading — consider an override." />
          )}
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'history' && <HistoryTab lotId={lotId} />}
      {tab === 'backward' && <BackwardTraceTab lotId={lotId} />}
      {tab === 'forward' && <ForwardTraceTab lotId={lotId} />}
    </div>
  )
}

function abvText(lot: Lot): string {
  return lot.abv ? `${lot.abv}%` : '—'
}

function Fact({
  label,
  value,
  sub,
  mono,
}: {
  label: string
  value: string
  sub?: string
  mono?: boolean
}) {
  return (
    <div className={styles.fact}>
      <div className={styles.factLabel}>{label}</div>
      <div className={`${mono ? 'mono ' : ''}${styles.factValue}`}>{value}</div>
      {sub && <div className={styles.factSub}>{sub}</div>}
    </div>
  )
}

function Flag({ text }: { text: string }) {
  return (
    <div className={styles.flag}>
      <IconAlertTriangle size={18} stroke={1.9} />
      <span>{text}</span>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
