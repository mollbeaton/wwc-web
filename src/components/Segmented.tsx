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
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div className={styles.segments}>
        {options.map((option) => (
          <button
            key={option.value}
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
