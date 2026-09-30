import { useQuery } from '@tanstack/react-query'
import { IconCheck } from '@tabler/icons-react'
import { lotsApi, type LotEvent } from '../../api/lots'
import { fixed, gbp, shortDate } from '../../lib/format'
import styles from './LotPage.module.css'

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryTab({ lotId }: { lotId: string }) {
  const recon = useQuery({
    queryKey: ['lot', lotId, 'reconciliation'],
    queryFn: () => lotsApi.reconciliation(lotId),
  })
  const duty = useQuery({
    queryKey: ['lot', lotId, 'duty'],
    queryFn: () => lotsApi.dutyLine(lotId),
  })
  const events = useQuery({
    queryKey: ['lot', lotId, 'events'],
    queryFn: () => lotsApi.events(lotId),
  })

  return (
    <div className={styles.tabBody}>
      <div className="card">
        <h3 className={styles.sectionTitle}>Volume reconciliation</h3>
        {recon.data && (
          <div className={styles.recon}>
            <ReconRow label="Started with" value={`${fixed(recon.data.starting_volume_l, 1)} L`} />
            <ReconRow
              label="Losses"
              value={`− ${fixed(recon.data.lost_volume_l, 1)} L`}
              muted
            />
            <ReconRow
              label="Split, blended or packaged off"
              value={`− ${fixed(recon.data.split_off_volume_l, 1)} L`}
              muted
            />
            <div className={styles.reconTotal}>
              <span>Now</span>
              <span className="mono">{fixed(recon.data.current_volume_l, 1)} L</span>
            </div>
            <div className={recon.data.reconciles ? styles.balances : styles.imbalance}>
              {recon.data.reconciles ? (
                <>
                  <IconCheck size={15} stroke={2.2} /> Balances
                </>
              ) : (
                'Does not balance — check the ledger'
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className={styles.sectionTitle}>Duty</h3>
        {duty.data ? (
          <div className={styles.dutyGrid}>
            <DutyFact label="Category" value={duty.data.category_label} />
            <DutyFact label="Pure alcohol" value={`${fixed(duty.data.lpa, 2)} L`} mono />
            <DutyFact label="Full rate" value={`${gbp(duty.data.full_rate)}/L`} mono />
            <DutyFact
              label="SPR discount"
              value={
                duty.data.spr_discount_per_lpa === '0.00'
                  ? 'None'
                  : `− ${gbp(duty.data.spr_discount_per_lpa)}/L`
              }
              mono
            />
            <DutyFact label="Rate charged" value={`${gbp(duty.data.rate_charged)}/L`} mono />
            <DutyFact label="Duty owed" value={gbp(duty.data.duty_owed)} mono strong />
            <DutyFact label="Duty point" value={shortDate(duty.data.duty_point_date)} />
            {duty.data.is_adjustment && <DutyFact label="Note" value="Adjustment line" />}
          </div>
        ) : (
          <p className={styles.muted}>
            No duty line — this lot hasn't been marked ready for sale.
          </p>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 className={styles.sectionTitle} style={{ padding: '20px 22px 0' }}>
          History
        </h3>
        <div className={styles.eventScroll}>
          <div className={`${styles.eventRow} ${styles.eventHead}`}>
            <span>Happened</span>
            <span>Entered</span>
            <span>By</span>
            <span>Event</span>
            <span className={styles.num}>Change</span>
            <span className={styles.num}>Balance</span>
          </div>
          {events.data?.map((e) => <EventRow key={e.id} event={e} />)}
          {events.data && events.data.length === 0 && (
            <p className={styles.muted} style={{ padding: '12px 22px' }}>
              No events yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: LotEvent }) {
  const cls = [
    styles.eventRow,
    event.is_corrected ? styles.eventCorrected : '',
    event.is_correction ? styles.eventCorrection : '',
    event.is_abv_override ? styles.eventOverride : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <span>{dateTime(event.occurred_at)}</span>
      <span className={event.is_backdated ? styles.late : styles.muted}>
        {dateTime(event.recorded_at)}
      </span>
      <span className={styles.by}>{event.recorded_by_email ?? '—'}</span>
      <span>{event.description}</span>
      <span className={`mono ${styles.num}`}>{event.change ?? '—'}</span>
      <span className={`mono ${styles.num}`}>
        {event.balance_l != null ? `${fixed(event.balance_l, 1)} L` : '—'}
      </span>
    </div>
  )
}

function ReconRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={styles.reconRow}>
      <span className={muted ? styles.muted : ''}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  )
}

function DutyFact({
  label,
  value,
  mono,
  strong,
}: {
  label: string
  value: string
  mono?: boolean
  strong?: boolean
}) {
  return (
    <div className={styles.dutyFact}>
      <div className={styles.factLabel}>{label}</div>
      <div className={`${mono ? 'mono ' : ''}${strong ? styles.dutyStrong : styles.factValue}`}>
        {value}
      </div>
    </div>
  )
}
