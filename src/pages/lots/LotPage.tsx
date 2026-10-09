import { useQuery } from '@tanstack/react-query'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { lotsApi, type Lot } from '../../api/lots'
import { vesselsApi } from '../../api/vessels'
import { BackLink } from '../../components/BackLink'
import { Tabs, type TabDef } from '../../components/Tabs'
import { cap, fixed, gbp, shortDate } from '../../lib/format'
import { lotStatusPill } from '../../lib/lotStatus'
import { HistoryTab } from './HistoryTab'
import { TraceTab } from './TraceTab'
import styles from './LotPage.module.css'

type LotTab = 'history' | 'trace'

const TABS: TabDef<LotTab>[] = [
  { value: 'history', label: 'History' },
  { value: 'trace', label: 'Trace' },
]

export function LotPage() {
  const { lotId = '' } = useParams()
  // ?tab=trace opens straight on the trace - where a code search lands.
  const [params] = useSearchParams()
  const [tab, setTab] = useState<LotTab>(params.get('tab') === 'trace' ? 'trace' : 'history')

  const vessels = useQuery({ queryKey: ['vessels'], queryFn: vesselsApi.list })
  const lotQuery = useQuery({ queryKey: ['lot', lotId], queryFn: () => lotsApi.get(lotId) })
  // Same key as the History tab's duty card, so this is one request, shared.
  const duty = useQuery({ queryKey: ['lot', lotId, 'duty'], queryFn: () => lotsApi.dutyLine(lotId) })

  const back = <BackLink fallbackTo="/tanks" fallbackLabel="Tanks" />

  if (lotQuery.isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading lot">
        {back}
        <div className={`skeleton ${styles.headerSkeleton}`} />
        <div className={styles.facts}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.factSkeleton}`} />
          ))}
        </div>
      </div>
    )
  }
  if (lotQuery.error || !lotQuery.data) {
    return (
      <div>
        {back}
        <p className={styles.error}>
          {lotQuery.error instanceof ApiError ? lotQuery.error.message : 'Could not load the lot'}
        </p>
      </div>
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
      {back}

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={`mono ${styles.code}`}>{lot.code}</h1>
          {lot.name && <span className={styles.name}>{lot.name}</span>}
        </div>
        <div className={styles.headerMeta}>
          {(lot.display_type ?? lot.product_type) && (
            <span className="pill pill--grey">{cap(lot.display_type ?? lot.product_type!)}</span>
          )}
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
          // Packaged: sparkling/still is already a header pill, so these facts
          // cover what's left - pack size, strength, closure, and the tax owed.
          <>
            {lot.unit_count != null && lot.unit_volume_l != null ? (
              <Fact
                label="Units"
                value={`${lot.unit_count} × ${lot.unit_volume_l} L`}
                sub={`${fixed(lot.current_volume_l, 0)} L total`}
                mono
              />
            ) : (
              <Fact label="Volume" value={`${fixed(lot.current_volume_l, 0)} L`} mono />
            )}
            <Fact label="ABV" value={abvText(lot)} sub={lot.abv_method ?? undefined} mono />
            <Fact label="Closure" value={lot.closure ? cap(lot.closure) : '—'} />
            {duty.data ? (
              <Fact
                label="Duty owed"
                value={gbp(duty.data.duty_owed)}
                sub={`Duty point ${shortDate(duty.data.duty_point_date)}`}
                mono
              />
            ) : (
              <Fact label="Duty owed" value="—" sub={duty.isPending ? undefined : 'Not released yet'} />
            )}
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
      {tab === 'trace' && <TraceTab lotId={lotId} />}
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
