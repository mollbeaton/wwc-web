import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconAlertTriangle, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { dutyApi, type DutyLine, type MonthlyReturn as MonthlyReturnData } from '../../api/duty'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { gbp, fixed, monthLabel, shortDate } from '../../lib/format'
import styles from './MonthlyReturn.module.css'

interface Period {
  year: number
  month: number
}

/** The last `count` months, newest first, ending at the current month. */
function recentMonths(count: number): Period[] {
  const now = new Date()
  const out: Period[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return out
}

export function MonthlyReturn() {
  const months = useMemo(() => recentMonths(8), [])
  const [selected, setSelected] = useState<Period>(months[0])
  const { effectiveRole } = useAuth()
  const queryClient = useQueryClient()

  const filedQuery = useQuery({
    queryKey: ['duty', 'filed-months'],
    queryFn: () => dutyApi.filedMonths(),
  })
  const returnQuery = useQuery({
    queryKey: ['duty', 'return', selected.year, selected.month],
    queryFn: () => dutyApi.monthlyReturn(selected.year, selected.month),
  })

  const filedSet = new Set((filedQuery.data ?? []).map((f) => `${f.period_year}-${f.period_month}`))

  async function markFiled() {
    await dutyApi.markFiled(selected.year, selected.month)
    await queryClient.invalidateQueries({ queryKey: ['duty'] })
  }

  return (
    <div>
      <div className={styles.chips}>
        {months.map((m) => {
          const isSelected = m.year === selected.year && m.month === selected.month
          const filed = filedSet.has(`${m.year}-${m.month}`)
          return (
            <button
              key={`${m.year}-${m.month}`}
              className={`${styles.chip} ${isSelected ? styles.chipActive : ''}`}
              onClick={() => setSelected(m)}
            >
              <span>{monthLabel(m.year, m.month)}</span>
              <span className={`pill ${filed ? 'pill--green' : 'pill--grey'} ${styles.chipPill}`}>
                {filed ? 'Filed' : 'Open'}
              </span>
            </button>
          )
        })}
      </div>

      {returnQuery.isLoading && <p className={styles.muted}>Loading…</p>}
      {returnQuery.error && (
        <p className={styles.error}>
          {returnQuery.error instanceof ApiError
            ? returnQuery.error.message
            : 'Could not load the return'}
        </p>
      )}
      {returnQuery.data && (
        <ReturnBody
          data={returnQuery.data}
          canFile={effectiveRole === 'admin'}
          onFile={markFiled}
        />
      )}
    </div>
  )
}

function ReturnBody({
  data,
  canFile,
  onFile,
}: {
  data: MonthlyReturnData
  canFile: boolean
  onFile: () => void
}) {
  const hasLines = data.groups.length > 0 || data.adjustments.length > 0

  return (
    <>
      <div className={styles.statusLine}>
        <div>
          {data.filed ? (
            <span className="pill pill--green">
              Filed{data.filed_at ? ` · ${shortDate(data.filed_at)}` : ''}
            </span>
          ) : (
            <span className="pill pill--amber">Open</span>
          )}
        </div>
        <div className={styles.statusActions}>
          <button className="btn" disabled title="CSV export coming soon">
            Export CSV
          </button>
          {canFile && !data.filed && (
            <button className="btn btn--primary" onClick={onFile}>
              Mark as filed
            </button>
          )}
        </div>
      </div>

      {data.flags.length > 0 && (
        <div className={styles.flags}>
          <div className={styles.flagsHead}>
            <IconAlertTriangle size={18} stroke={1.9} />
            Check before filing
          </div>
          <ul>
            {data.flags.map((flag, i) => (
              <li key={i}>
                <span className="mono">{flag.lot_code}</span> — {flag.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasLines && <div className="card muted">No duty lines in this month yet.</div>}

      {data.groups.map((group) => (
        <ReturnGroup key={group.category} group={group} />
      ))}

      {data.adjustments.length > 0 && (
        <div className={styles.adjustments}>
          <h3 className={styles.sectionTitle}>Adjustments to filed months</h3>
          {data.adjustments.map((line) => (
            <div key={line.id} className={styles.adjustmentRow}>
              <span className="mono">{line.lot_code}</span>
              <span>{line.category_label}</span>
              <span className="mono">{fixed(line.lpa, 2)} LPA</span>
              <span className="mono">{gbp(line.duty_owed)}</span>
            </div>
          ))}
        </div>
      )}

      {hasLines && (
        <div className={styles.totalRow}>
          <span>Total</span>
          <span className="mono">{fixed(data.total_lpa, 2)} LPA</span>
          <span className="mono">{gbp(data.total_duty)}</span>
        </div>
      )}
    </>
  )
}

function ReturnGroup({ group }: { group: { category: string } & ReturnGroupData }) {
  const [open, setOpen] = useState(false)
  const Chevron = open ? IconChevronDown : IconChevronRight
  return (
    <div className="card" style={{ marginBottom: 12, padding: 0 }}>
      <button className={styles.groupHead} onClick={() => setOpen((o) => !o)}>
        <Chevron size={18} stroke={1.9} className={styles.chevron} />
        <div className={styles.groupTitle}>
          <span className={styles.groupLabel}>{group.category_label}</span>
          <span className={styles.groupRelief}>
            {group.relief_table_label ?? 'No relief'} · {group.lines.length}{' '}
            {group.lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <span className={`mono ${styles.groupLpa}`}>{fixed(group.total_lpa, 2)} LPA</span>
        <span className={`mono ${styles.groupDuty}`}>{gbp(group.total_duty)}</span>
      </button>
      {open && (
        <div className={styles.detailWrap}>
          <div className={`${styles.detailRow} ${styles.detailHead}`}>
            <span>Date</span>
            <span>Lot</span>
            <span className={styles.num}>Litres</span>
            <span className={styles.num}>ABV</span>
            <span className={styles.num}>LPA</span>
            <span className={styles.num}>Full</span>
            <span className={styles.num}>SPR</span>
            <span className={styles.num}>Charged</span>
            <span className={styles.num}>Duty</span>
          </div>
          {group.lines.map((line) => (
            <DetailRow key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}

interface ReturnGroupData {
  category_label: string
  relief_table_label: string | null
  total_lpa: string
  total_duty: string
  lines: DutyLine[]
}

function DetailRow({ line }: { line: DutyLine }) {
  return (
    <div className={styles.detailRow}>
      <span>{shortDate(line.duty_point_date)}</span>
      <span className="mono">{line.lot_code}</span>
      <span className={`mono ${styles.num}`}>{fixed(line.volume_l, 1)}</span>
      <span className={`mono ${styles.num} ${line.abv_method === 'manual' ? styles.manual : ''}`}>
        {line.abv}% {line.abv_method === 'manual' ? 'man.' : 'calc'}
      </span>
      <span className={`mono ${styles.num}`}>{fixed(line.lpa, 2)}</span>
      <span className={`mono ${styles.num}`}>{fixed(line.full_rate, 2)}</span>
      <span className={`mono ${styles.num}`}>
        {line.spr_discount_per_lpa === '0.00' ? '—' : fixed(line.spr_discount_per_lpa, 2)}
      </span>
      <span className={`mono ${styles.num}`}>{fixed(line.rate_charged, 2)}</span>
      <span className={`mono ${styles.num}`}>{gbp(line.duty_owed)}</span>
    </div>
  )
}
