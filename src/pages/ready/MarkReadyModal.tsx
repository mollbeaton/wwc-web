import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { productsApi } from '../../api/catalog'
import { lotsApi } from '../../api/lots'
import type { AwaitingRelease, CannerAwaiting } from '../../api/stock'
import { stockApi } from '../../api/stock'
import { Modal, ModalActions } from '../../components/Modal'
import { lotKindLabel } from '../../lib/format'
import { errorText, nowIso, positiveInt } from '../../lib/stock'
import styles from '../stock/Stock.module.css'

/** Release a packaged lot into stock as a product. The product must match the
 *  lot's format - same kind and unit size - so only those are offered. */
export function MarkReadyModal({ lot, onClose }: { lot: AwaitingRelease; onClose: () => void }) {
  const queryClient = useQueryClient()
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const matching = (products.data ?? []).filter(
    (p) =>
      p.status === 'active' &&
      p.kind === lot.kind &&
      lot.unit_volume_l != null &&
      Number(p.unit_volume_l) === Number(lot.unit_volume_l),
  )
  const [productId, setProductId] = useState(lot.product_id ?? '')
  const [productType, setProductType] = useState<'cider' | 'wine'>(lot.product_type ?? 'cider')
  const [error, setError] = useState<string | null>(null)
  // One id for this release, reused if the save is retried.
  const [id] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () =>
      lotsApi.markReadyForSale(lot.lot_id, {
        id,
        occurred_at: nowIso(),
        product_type: productType,
        ...(productId ? { product_id: productId } : {}),
      }),
    onSuccess: async () => {
      await Promise.all(
        [['lots'], ['lot', lot.lot_id], ['stock']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      onClose()
    },
    onError: (e) => setError(errorText(e, 'Could not mark the lot ready for sale')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <Modal
      title={`Mark ${lot.lot_code} ready for sale`}
      onClose={onClose}
      dismissable={!save.isPending}
      as="form"
      onSubmit={onSubmit}
    >
      <p className={styles.hint}>
        {lotKindLabel(lot.kind)}
        {lot.unit_count != null && lot.unit_volume_l != null && ` · ${lot.unit_count} × ${lot.unit_volume_l} L`}
        {lot.name && ` · ${lot.name}`}
      </p>
      <label className={styles.field}>
        <span>Product</span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose…</option>
          {matching.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </label>
      {products.data && matching.length === 0 && (
        <p className={styles.warn}>
          No product is set up for this format. Add one under Manage → Products first.
        </p>
      )}
      <label className={styles.field}>
        <span>Product type (for duty)</span>
        <select value={productType} onChange={(e) => setProductType(e.target.value as 'cider' | 'wine')}>
          <option value="cider">Cider</option>
          <option value="wine">Wine</option>
        </select>
      </label>
      <p className={styles.hint}>This is the duty point: the lot goes on this month’s return.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!productId || save.isPending}>
          {save.isPending ? 'Saving…' : 'Mark ready for sale'}
        </button>
      </ModalActions>
    </Modal>
  )
}

/** Cans back from the canner: how many came back, and as which product. */
export function CannerReceiptModal({ lot, onClose }: { lot: CannerAwaiting; onClose: () => void }) {
  const queryClient = useQueryClient()
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const cans = (products.data ?? []).filter((p) => p.status === 'active' && p.kind === 'can')
  const [productId, setProductId] = useState('')
  const [count, setCount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [id] = useState(() => crypto.randomUUID())
  const units = positiveInt(count)

  const save = useMutation({
    mutationFn: () =>
      stockApi.receiveCans({ id, lot_id: lot.lot_id, product_id: productId, unit_count: units!, occurred_at: nowIso() }),
    onSuccess: async () => {
      await Promise.all(
        [['lots'], ['lot', lot.lot_id], ['stock']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      onClose()
    },
    onError: (e) => setError(errorText(e, 'Could not record the cans')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  const product = cans.find((p) => p.id === productId)
  const expected = product ? Math.floor(Number(lot.volume_l) / Number(product.unit_volume_l)) : null

  return (
    <Modal title={`Cans back for ${lot.lot_code}`} onClose={onClose} dismissable={!save.isPending} as="form" onSubmit={onSubmit}>
      <p className={styles.hint}>
        {lot.volume_l} L sent{lot.canner && ` to ${lot.canner}`}
      </p>
      <label className={styles.field}>
        <span>Product</span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose…</option>
          {cans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Cans received</span>
        <input type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      {expected != null && <p className={styles.hint}>About {expected} cans at full yield.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!productId || units == null || save.isPending}>
          {save.isPending ? 'Saving…' : 'Receive cans'}
        </button>
      </ModalActions>
    </Modal>
  )
}
