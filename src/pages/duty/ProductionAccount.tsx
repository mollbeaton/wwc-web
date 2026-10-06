import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { dutyApi } from '../../api/duty'
import { ApiError } from '../../api/client'
import { fixed, monthLabel, productionYearLabel } from '../../lib/format'
import styles from './ProductionAccount.module.css'

/**
 * WD-25. Monthly production in hectolitres of pure alcohol, counted at
 * packaging, with the year total that feeds the next year's SPR.
 */
function currentProductionYear(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 2 ? now.getFullYear() : now.getFullYear() - 1
}

export function ProductionAccount() {
  const current = useMemo(() => currentProductionYear(), [])
  const [year, setYear] = useState(current)
  const years = [current, current - 1]

  const query = useQuery({
    queryKey: ['duty', 'production-account', year],
    queryFn: () => dutyApi.productionAccount(year),
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

      <p className={styles.sub}>
        Production in hectolitres of pure alcohol, counted at packaging. This year's total sets the{' '}
        {productionYearLabel(year + 1)} SPR rates.
      </p>

      {query.isLoading && <p className={styles.muted}>Loading…</p>}
      {query.error && (
        <p className={styles.error}>
          {query.error instanceof ApiError ? query.error.message : 'Could not load the account'}
        </p>
      )}

      {query.data && (
        <div className="card card--flush">
          <div className={`${styles.row} ${styles.head}`}>
            <span>Month</span>
            <span className={styles.num}>hl of pure alcohol</span>
          </div>
          {query.data.months.length === 0 && (
            <div className={styles.empty}>No production recorded this year yet.</div>
          )}
          {query.data.months.map((m) => (
            <div className={styles.row} key={`${m.year}-${m.month}`}>
              <span>{monthLabel(m.year, m.month)}</span>
              <span className={`mono ${styles.num}`}>{fixed(m.hl_pure_alcohol, 2)}</span>
            </div>
          ))}
          <div className={`${styles.row} ${styles.total}`}>
            <span>Year total</span>
            <span className={`mono ${styles.num}`}>{fixed(query.data.year_total_hl, 2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
