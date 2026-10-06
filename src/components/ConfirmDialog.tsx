import type { ReactNode } from 'react'
import { Modal, ModalActions } from './Modal'
import styles from './ConfirmDialog.module.css'

/** "Are you sure?" for actions that are hard to undo (filing a return,
 *  deleting a record, locking someone out). Stays open while `pending` and
 *  shows `error` in place, so a failed request is never silent. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  tone = 'primary',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  pendingLabel?: string
  tone?: 'primary' | 'danger'
  pending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel} dismissable={!pending}>
      <div className={styles.body}>{children}</div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
        </button>
      </ModalActions>
    </Modal>
  )
}
