import { useQuery } from '@tanstack/react-query'
import { IconExternalLink } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { dutyApi } from '../../api/duty'
import { ApiError } from '../../api/client'
import { fixed, gbp, productionYearLabel } from '../../lib/format'
import styles from './SprRates.module.css'

/** The production year (starting calendar year) that a date falls in. */
function currentProductionYear(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 2 ? now.getFullYear() : now.getFullYear() - 1
}

export function SprRates() {
  const current = useMemo(() => currentProductionYear(), [])
  const [year, setYear] = useState(current)
  const years = [current, current - 1]

  const query = useQuery({
    queryKey: ['duty', 'spr-rates', year],
    queryFn: () => dutyApi.sprRates(year),
  })

  return (
    <div>
      <div className={styles.yearChips}>
        {years.map((y) => (
          <button
            key={y}
            className={`${styles.yearChip} ${y === year ? styles.yearActive : ''}`}
            onClick={() => setYear(y)}
          >
            {productionYearLabel(y)}
            {y === current ? ' · current' : ''}
          </button>
        ))}
      </div>

      <div className={styles.demoNote}>
        <strong>Demo figures.</strong> The bands are placeholders to show the working. Seed this
        page from HMRC's published SPR tables from 1 February 2026 before relying on it.
      </div>

      {query.isLoading && <p className={styles.muted}>Loading…</p>}
      {query.error && (
        <p className={styles.error}>
          {query.error instanceof ApiError ? query.error.message : 'Could not load SPR rates'}
        </p>
      )}

      {query.data && (
        <>
          <p className={styles.basis}>
            {query.data.basis_production_hl == null ? (
              <>
                No production figure recorded for {productionYearLabel(year - 1)}, so no relief is
                calculated for {productionYearLabel(year)}.
              </>
            ) : (
              <>
                Based on {productionYearLabel(query.data.based_on_production_year)} production of{' '}
                <strong>{fixed(query.data.basis_production_hl, 2)} hl</strong> of pure alcohol.
                Discount = (production − band start) × marginal + cumulative, ÷ production, rounded
                up to the penny.
              </>
            )}
          </p>

          {query.data.tables.map((table) => (
            <div className="card" key={table.spr_table} style={{ marginBottom: 12 }}>
              <div className={styles.tableHead}>
                <div>
                  <div className={styles.tableName}>{table.spr_table_label}</div>
                  <div className={styles.tableApplies}>{table.applies_to}</div>
                </div>
                <div className={styles.perLitre}>
                  <span className="mono">{gbp(table.discount_per_lpa)}</span>
                  <span className={styles.perLitreUnit}>/L discount</span>
                </div>
              </div>
              <div className={styles.working}>{table.working}</div>
              <div className={styles.charged}>
                Charged <span className="mono">{gbp(table.rate_charged)}</span> of{' '}
                <span className="mono">{gbp(table.full_rate)}</span> full rate
              </div>
            </div>
          ))}

          <a
            className={styles.hmrcLink}
            href="https://www.gov.uk/guidance/how-to-work-out-your-alcohol-duty-rates-if-youre-eligible-for-small-producer-relief"
            target="_blank"
            rel="noreferrer"
          >
            <IconExternalLink size={16} stroke={1.8} />
            Check these against HMRC's SPR guidance and rate finder
          </a>
        </>
      )}
    </div>
  )
}
