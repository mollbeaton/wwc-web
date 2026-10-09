import type { RecallLine } from '../../api/trace'
import styles from './RecallSummary.module.css'

const CATEGORY: Record<RecallLine['category'], { label: string; tone: string }> = {
  ready_for_sale: { label: 'Ready for sale', tone: styles.green },
  packaged: { label: 'Packaged, not ready', tone: styles.grey },
  in_tank: { label: 'Still in tanks', tone: styles.blue },
}

const KIND_PLURAL: Record<string, string> = {
  bottle: 'bottles',
  bag_in_box: 'bag-in-box',
  can: 'cans',
}

/** Where the product is now, in litres and units - what a recall needs,
 *  rather than a count of lots. */
export function RecallSummary({ title, lines }: { title: string; lines: RecallLine[] }) {
  return (
    <div className="card">
      <h2 className={styles.title}>{title}</h2>
      {lines.length === 0 ? (
        <p className={styles.muted}>Nothing left anywhere — all used up or lost.</p>
      ) : (
        <div className={styles.lines}>
          {lines.map((line, i) => {
            const category = CATEGORY[line.category]
            return (
              <div key={i} className={`${styles.line} ${category.tone}`}>
                <div className={styles.lineLabel}>{category.label}</div>
                <div className={`mono ${styles.lineValue}`}>{describe(line)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function describe(line: RecallLine): string {
  const litres = `${trim(line.volume_l)} L`
  if (line.lot_kind === 'tank' || line.units == null) return litres
  const unit = line.unit_volume_l ? ` × ${trim(line.unit_volume_l)} L` : ''
  return `${line.units}${unit} ${KIND_PLURAL[line.lot_kind] ?? line.lot_kind} · ${litres}`
}

function trim(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}
