import { useId } from 'react'
import styles from './Segmented.module.css'

export interface SegmentOption {
  value: string
  label: string
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
}) {
  const labelId = useId()
  return (
    <div className={styles.group}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <div className={styles.segments} role="group" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            className={`${styles.segment} ${option.value === value ? styles.active : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
