import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconExternalLink } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { dutyApi, type OpeningProduction } from '../../api/duty'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { Tabs, type TabDef } from '../../components/Tabs'
import { fixed, gbp, productionYearLabel, shortDate } from '../../lib/format'
import styles from './DutySettings.module.css'

type SettingsTab = 'rates' | 'spr' | 'opening'

const TABS: TabDef<SettingsTab>[] = [
  { value: 'rates', label: 'Full rates' },
  { value: 'spr', label: 'SPR tables' },
  { value: 'opening', label: 'Opening figures' },
]

export function DutySettings() {
  const [tab, setTab] = useState<SettingsTab>('rates')
  return (
    <div>
      <PageHeader
        title="Duty settings"
        subtitle="The rates and relief tables the duty engine reads. Rates are data, replaced each 1 February — never edited."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'rates' && <FullRates />}
      {tab === 'spr' && <SprTables />}
      {tab === 'opening' && <OpeningFigures />}
    </div>
  )
}

function FullRates() {
  const query = useQuery({ queryKey: ['duty', 'ref', 'full-rates'], queryFn: dutyApi.fullRates })
  return (
    <div>
      {query.data && (
        <div className="card card--flush">
          <div className={`${styles.rateRow} ${styles.head}`}>
            <span>Category</span>
            <span>Effective from</span>
            <span className={styles.num}>£ per litre of pure alcohol</span>
          </div>
          {query.data.map((rate) => (
            <div className={styles.rateRow} key={rate.category}>
              <span>{rate.category_label}</span>
              <span>{shortDate(rate.effective_from)}</span>
              <span className={`mono ${styles.num}`}>{gbp(rate.rate_per_lpa)}</span>
            </div>
          ))}
        </div>
      )}
      <SourceLink
        href="https://www.gov.uk/guidance/alcohol-duty-rates"
        label="HMRC alcohol duty rates from 1 February 2026"
      />
    </div>
  )
}

function SprTables() {
  const query = useQuery({ queryKey: ['duty', 'ref', 'spr-tables'], queryFn: dutyApi.sprTables })
  return (
    <div>
      <div className={styles.demoNote}>
        <strong>Demo placeholders.</strong> These bands show the layout only. Seed them from HMRC's
        published SPR tables before relying on the relief figures.
      </div>
      {query.data?.map((table) => (
        <div className={`card ${styles.stacked}`} key={table.spr_table}>
          <div className={styles.tableName}>{table.spr_table_label}</div>
          <div className={styles.tableApplies}>{table.applies_to}</div>
          <div className={styles.bandTable}>
            <div className={`${styles.bandRow} ${styles.head}`}>
              <span>From (hl)</span>
              <span>To (hl)</span>
              <span className={styles.num}>Marginal £/hl</span>
              <span className={styles.num}>Cumulative £</span>
            </div>
            {table.bands.map((band, i) => (
              <div className={styles.bandRow} key={i}>
                <span className="mono">{fixed(band.band_start_hl, 2)}</span>
                <span className="mono">{fixed(band.band_end_hl, 2)}</span>
                <span className={`mono ${styles.num}`}>{gbp(band.marginal_per_hl)}</span>
                <span className={`mono ${styles.num}`}>{gbp(band.cumulative_gbp)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function OpeningFigures() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['duty', 'ref', 'opening'],
    queryFn: dutyApi.openingProduction,
  })
  return (
    <div>
      <p className={styles.sub}>
        Records start on 1 February 2026, so an earlier production year's total is entered by hand.
        It sets that year's SPR rates. Editing a figure recalculates the rates but never changes
        duty already charged.
      </p>
      {query.data?.map((row) => (
        <OpeningRow
          key={row.production_year}
          row={row}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['duty'] })}
        />
      ))}
    </div>
  )
}

function OpeningRow({ row, onSaved }: { row: OpeningProduction; onSaved: () => void }) {
  const [value, setValue] = useState(row.hl_pure_alcohol)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = value !== row.hl_pure_alcohol

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await dutyApi.setOpeningProduction(row.production_year, value, row.note)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={`card ${styles.stacked}`} onSubmit={onSubmit}>
      <div className={styles.openingRow}>
        <div>
          <div className={styles.openingYear}>
            {productionYearLabel(row.production_year)} production
          </div>
          {row.note && <div className={styles.openingNote}>{row.note}</div>}
        </div>
        <div className={styles.openingInput}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Hectolitres of pure alcohol"
          />
          <span className={styles.unit}>hl</span>
        </div>
        <button type="submit" className="btn btn--primary" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  )
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a className={styles.sourceLink} href={href} target="_blank" rel="noreferrer">
      <IconExternalLink size={16} stroke={1.8} />
      {label}
    </a>
  )
}
