import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { lotsApi, type LotEvent } from '../../api/lots'
import styles from './CorrectionModal.module.css'

type Mode = 'value' | 'time'

/** WD-40/CH-04: correct a loss or addition entry - a new amount or the time it
 *  happened, plus a required reason. Saving adds a correction event referencing
 *  the original; nothing is edited in place. */
export function CorrectionModal({
  lotId,
  event,
  hasDutyLine,
  onClose,
}: {
  lotId: string
  event: LotEvent
  hasDutyLine: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isLoss = event.correct_kind === 'loss'
  const currentValue = isLoss ? (event.loss_volume_l ?? '') : (event.addition_amount ?? '')
  const unit = isLoss ? 'L' : (event.addition_unit ?? '')

  const [mode, setMode] = useState<Mode>('value')
  const [value, setValue] = useState(currentValue)
  // datetime-local wants "YYYY-MM-DDTHH:mm".
  const [when, setWhen] = useState(new Date(event.occurred_at).toISOString().slice(0, 16))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const id = crypto.randomUUID()
      const occurred_at = mode === 'time' ? new Date(when).toISOString() : event.occurred_at
      const amount = mode === 'value' ? value : currentValue
      if (isLoss) {
        return lotsApi.correctLoss(lotId, event.id, { id, occurred_at, volume_l: amount, reason })
      }
      return lotsApi.correctAddition(lotId, event.id, {
        id,
        occurred_at,
        kind: event.addition_type ?? '',
        amount,
        unit,
        note: reason,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lot', lotId] })
      onClose()
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save the correction'),
  })

  const valid = reason.trim().length > 0 && (mode === 'time' || Number(value) > 0)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3 className={styles.title}>Correct this {isLoss ? 'loss' : 'addition'}</h3>
        <p className={styles.sub}>{event.description} · {event.change}</p>

        <div className={styles.modes}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'value' ? styles.modeActive : ''}`}
            onClick={() => setMode('value')}
          >
            Amount
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'time' ? styles.modeActive : ''}`}
            onClick={() => setMode('time')}
          >
            Time it happened
          </button>
        </div>

        {mode === 'value' ? (
          <label className={styles.field}>
            <span>New {isLoss ? 'volume (L)' : `amount (${unit})`}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </label>
        ) : (
          <label className={styles.field}>
            <span>When it happened</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        )}

        <label className={styles.field}>
          <span>Reason (required)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </label>

        {hasDutyLine && (
          <div className={styles.dutyWarning}>
            <IconAlertTriangle size={16} stroke={1.9} />
            This lot has a duty line. A correction that changes its volume or ABV produces an
            adjustment on the next open return.
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </form>
    </div>
  )
}
