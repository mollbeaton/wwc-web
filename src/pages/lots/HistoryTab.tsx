import { useQuery } from '@tanstack/react-query'
import { IconCheck } from '@tabler/icons-react'
import { lotsApi } from '../../api/lots'
import { fixed, gbp, shortDate } from '../../lib/format'
import styles from './LotPage.module.css'

export function HistoryTab({ lotId }: { lotId: string }) {
  const recon = useQuery({
    queryKey: ['lot', lotId, 'reconciliation'],
    queryFn: () => lotsApi.reconciliation(lotId),
  })
  const duty = useQuery({
    queryKey: ['lot', lotId, 'duty'],
    queryFn: () => lotsApi.dutyLine(lotId),
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
