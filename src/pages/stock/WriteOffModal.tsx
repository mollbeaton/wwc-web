import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { stockApi, type StockRow, type WriteOffReason } from '../../api/stock'
import { Modal, ModalActions } from '../../components/Modal'
import { errorText, nowIso, positiveInt } from '../../lib/stock'
import { availableAt, locationsHolding, lotsAt } from './stockPicking'
import { WriteOffReasonPicker } from './WriteOffReasonPicker'
import styles from './Stock.module.css'

/** Stock that leaves without being sold: tastings, gifts, breakage, staff.
 *  The reason decides which Xero account it lands in, so it has no default.
 *  Without a lot, the API takes the units from the oldest lot there. */
export function WriteOffModal({ stock, onClose }: { stock: StockRow[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const inStock = stock.filter((r) => r.on_hand > 0)
  const [productId, setProductId] = useState(inStock[0]?.product_id ?? '')
  const row = stock.find((r) => r.product_id === productId)
  const [locationId, setLocationId] = useState(locationsHolding(row)[0]?.location_id ?? '')
  const [lotId, setLotId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<WriteOffReason | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Minted once when the dialog opens: a retry after a failure resends it, so
  // the API can't record the write-off twice.
  const [id] = useState(() => crypto.randomUUID())

  const available = availableAt(row, locationId, lotId)
  const units = positiveInt(qty)
  const valid = !!productId && !!locationId && units != null && units <= available && reason != null

  const save = useMutation({
    mutationFn: () =>
      stockApi.writeOff({
        id,
        product_id: productId,
        lot_id: lotId || undefined,
        location_id: locationId,
        qty: units!,
        reason: reason!,
        ...(note.trim() ? { note: note.trim() } : {}),
        occurred_at: nowIso(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (e) => setError(errorText(e, 'Could not record the write-off')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <Modal title="Write off stock" onClose={onClose} dismissable={!save.isPending} as="form" onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Product</span>
        <select
          value={productId}
          onChange={(e) => {
            const next = stock.find((r) => r.product_id === e.target.value)
            setProductId(e.target.value)
            setLocationId(locationsHolding(next)[0]?.location_id ?? '')
            setLotId('')
          }}
        >
          {inStock.map((r) => (
            <option key={r.product_id} value={r.product_id}>
              {r.code} · {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Location</span>
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setLotId('')
            }}
          >
            {locationsHolding(row).map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.location_name} ({l.qty})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Lot</span>
          <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Oldest first</option>
            {lotsAt(row, locationId).map((l) => (
              <option key={l.lot_id} value={l.lot_id}>
                {l.lot_code} ({l.qty})
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>Units</span>
        <input type="number" min="1" step="1" max={available} value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      {units != null && units > available && <p className={styles.error}>Only {available} there.</p>}
      <WriteOffReasonPicker value={reason} onChange={setReason} />
      <label className={styles.field}>
        <span>Note (optional)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!valid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Write off'}
        </button>
      </ModalActions>
    </Modal>
  )
}
