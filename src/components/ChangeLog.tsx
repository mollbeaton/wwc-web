import type { ChangeLogEntry } from '../api/management'
import styles from './ChangeLog.module.css'

function describe(entry: ChangeLogEntry): string {
  switch (entry.action) {
    case 'created':
      return 'Created'
    case 'retired':
      return 'Retired'
    case 'restored':
      return 'Restored'
    case 'deleted':
      return 'Deleted'
    case 'updated':
      return `Changed ${entry.field ?? ''}`.trim()
    default:
      return entry.action
  }
}

/** WD-30: the change log for a managed record — newest first, who, when,
 *  before → after. Shared across every management list. */
export function ChangeLog({ entries }: { entries: ChangeLogEntry[] }) {
  if (entries.length === 0) return <p className={styles.empty}>No changes yet.</p>
  return (
    <div className={styles.log}>
      {entries.map((entry) => (
        <div key={entry.id} className={styles.row}>
          <div className={styles.head}>
            <span className={styles.action}>{describe(entry)}</span>
            <span className={styles.meta}>
              {entry.changed_by_email ?? 'system'} ·{' '}
              {new Date(entry.changed_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          {entry.action === 'updated' && (
            <div className={styles.diff}>
              <span className={styles.before}>{entry.before_value || '—'}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.after}>{entry.after_value || '—'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
