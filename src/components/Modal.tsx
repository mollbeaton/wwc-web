import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import styles from './Modal.module.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The one dialog shell every modal uses: labelled for screen readers, closes
 *  on Esc or a backdrop click, keeps Tab inside the dialog, and hands focus
 *  back to whatever opened it on close. Pass `dismissable={false}` while a
 *  save is in flight so the dialog can't vanish mid-request. */
export function Modal({
  title,
  onClose,
  children,
  width = 440,
  dismissable = true,
  as = 'div',
  onSubmit,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
  dismissable?: boolean
  /** Render the dialog body as a <form> so Enter submits. */
  as?: 'div' | 'form'
  onSubmit?: (e: FormEvent) => void
}) {
  const titleId = useId()
  // Captured during the first render - before any autoFocus field inside the
  // dialog has moved focus - so we know what to hand focus back to on close.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const dialogRef = useRef<HTMLDivElement & HTMLFormElement>(null)
  // Read through a ref so the effect below doesn't re-run (and re-steal focus)
  // every time a parent re-renders with a new onClose closure.
  const closeRef = useRef(onClose)
  const dismissRef = useRef(dismissable)
  useEffect(() => {
    closeRef.current = onClose
    dismissRef.current = dismissable
  })

  useEffect(() => {
    const dialog = dialogRef.current
    // Focus the first field (or button) unless something inside already
    // claimed it via autoFocus.
    if (dialog && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [opener])

  const dialogProps = {
    ref: dialogRef,
    className: styles.dialog,
    style: { maxWidth: width },
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
  } as const
  const heading = (
    <h2 id={titleId} className={styles.title}>
      {title}
    </h2>
  )
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose()
      }}
    >
      {as === 'form' ? (
        <form {...dialogProps} onSubmit={onSubmit}>
          {heading}
          {children}
        </form>
      ) : (
        <div {...dialogProps}>
          {heading}
          {children}
        </div>
      )}
    </div>
  )
}

/** Right-aligned button row for the foot of a dialog. */
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}
