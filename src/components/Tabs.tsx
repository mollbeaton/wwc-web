import styles from './Tabs.module.css'

export interface TabDef<T extends string> {
  value: T
  label: string
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[]
  active: T
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={tab.value === active}
          className={`${styles.tab} ${tab.value === active ? styles.active : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
