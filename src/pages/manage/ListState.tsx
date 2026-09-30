import styles from './Management.module.css'

/** The loading / error / empty message shown inside a management table, so a
 * slow fetch (e.g. a Render cold start) no longer flashes the empty state as
 * if there were no records. Returns null once there are rows to show. */
export function ListState({
  isPending,
  isError,
  isEmpty,
  emptyLabel,
  onRetry,
}: {
  isPending: boolean
  isError: boolean
  isEmpty: boolean
  emptyLabel: string
  onRetry: () => void
}) {
  if (isPending) return <p className={styles.empty}>Loading…</p>
  if (isError)
    return (
      <p className={styles.empty}>
        Couldn’t load.{' '}
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      </p>
    )
  if (isEmpty) return <p className={styles.empty}>{emptyLabel}</p>
  return null
}
