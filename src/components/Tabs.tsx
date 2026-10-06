import { useRef, type KeyboardEvent } from 'react'
import styles from './Tabs.module.css'

export interface TabDef<T extends string> {
  value: T
  label: string
}

/** WAI-ARIA tabs: only the active tab is in the Tab order, and the arrow keys
 *  (plus Home/End) move between tabs and select as they go. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[]
  active: T
  onChange: (value: T) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next == null) return
    e.preventDefault()
    onChange(tabs[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab, i) => {
        const selected = tab.value === active
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.active : ''}`}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
