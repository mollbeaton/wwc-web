import { useId } from 'react'
import type { WriteOffReason } from '../../api/stock'
import { WRITE_OFF_REASONS } from '../../lib/stock'
import styles from './Stock.module.css'

/** The four write-off reasons as radios, each with where it lands in Xero.
 *  Nothing is picked to start with: the reason is required. */
export function WriteOffReasonPicker({
  value,
  onChange,
}: {
  value: WriteOffReason | null
  onChange: (reason: WriteOffReason) => void
}) {
  const name = useId()
  return (
    <fieldset className={styles.reasons}>
      <legend>Reason</legend>
      {WRITE_OFF_REASONS.map((r) => (
        <label key={r.value} className={`${styles.reason} ${value === r.value ? styles.reasonActive : ''}`}>
          <input
            type="radio"
            name={name}
            value={r.value}
            checked={value === r.value}
            onChange={() => onChange(r.value)}
          />
          <span>
            <span className={styles.reasonLabel}>{r.label}</span>
            <span className={styles.hint}>{r.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
