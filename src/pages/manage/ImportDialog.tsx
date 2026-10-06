import { useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import type { RefBody } from '../../api/referenceLists'
import { Modal, ModalActions } from '../../components/Modal'
import { parseImport } from './importRows'
import type { ManagementListConfig } from './ManagementList'
import styles from './ImportDialog.module.css'

/** Paste rows to bulk-add to a managed list, instead of one add-form per row.
 *  Previews what will be added / skipped / rejected before committing, then
 *  creates the valid new rows one by one (the API is the final guard on
 *  duplicates it couldn't see, e.g. a retired entry). */
export function ImportDialog({
  config,
  existingPrimaries,
  onClose,
  onImported,
}: {
  config: ManagementListConfig
  existingPrimaries: string[]
  onClose: () => void
  onImported: () => void
}) {
  const columns = config.importColumns ?? []
  const primaryField = config.primaryField ?? 'name'
  const labelFor = (key: string) => config.fields.find((f) => f.key === key)?.label ?? key
  const headerLine = columns.map(labelFor).join(', ')

  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ added: number; failed: { primary: string; reason: string }[] } | null>(
    null,
  )

  const parsed = useMemo(() => parseImport(text, config, existingPrimaries), [text, config, existingPrimaries])

  async function runImport() {
    setImporting(true)
    const failed: { primary: string; reason: string }[] = []
    let added = 0
    for (const row of parsed.toCreate) {
      try {
        await config.api.create(row)
        added++
      } catch (e) {
        failed.push({
          primary: String((row as RefBody)[primaryField] ?? ''),
          reason: e instanceof ApiError ? e.message : 'could not add',
        })
      }
    }
    setImporting(false)
    setResult({ added, failed })
    onImported()
  }

  return (
    <Modal title={`Import ${config.title.toLowerCase()}`} onClose={onClose} width={560} dismissable={!importing}>
      {result ? (
        <>
          <p className={styles.summary}>
            <span className={`${styles.count} ${styles.good}`}>Added {result.added}</span>
            {result.failed.length > 0 && (
              <span className={`${styles.count} ${styles.bad}`}>{result.failed.length} failed</span>
            )}
          </p>
          {result.failed.length > 0 && (
            <ul className={styles.invalidList}>
              {result.failed.map((f, i) => (
                <li key={i}>
                  {f.primary}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          <ModalActions>
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </ModalActions>
        </>
      ) : (
        <>
          <p className={styles.hint}>
            One per line, comma-separated: <code>{headerLine}</code>. A header row is optional.
          </p>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`${headerLine}\n…`}
            aria-label="Rows to import"
          />

          {text.trim() !== '' && (
            <p className={styles.summary}>
              <span className={`${styles.count} ${styles.good}`}>{parsed.toCreate.length} to add</span>
              {parsed.duplicates.length > 0 && (
                <span className={`${styles.count} ${styles.warn}`}>
                  {parsed.duplicates.length} already exist
                </span>
              )}
              {parsed.invalid.length > 0 && (
                <span className={`${styles.count} ${styles.bad}`}>{parsed.invalid.length} invalid</span>
              )}
            </p>
          )}

          {parsed.invalid.length > 0 && (
            <ul className={styles.invalidList}>
              {parsed.invalid.map((r) => (
                <li key={r.line}>
                  Line {r.line}: {r.reason} — <code>{r.text}</code>
                </li>
              ))}
            </ul>
          )}

          <ModalActions>
            <button className="btn" onClick={onClose} disabled={importing}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={runImport}
              disabled={parsed.toCreate.length === 0 || importing}
            >
              {importing ? 'Importing…' : `Import ${parsed.toCreate.length}`}
            </button>
          </ModalActions>
        </>
      )}
    </Modal>
  )
}
