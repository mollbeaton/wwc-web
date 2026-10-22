import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import {
  customersApi,
  locationsApi,
  productsApi,
  type CustomerKind,
  type CustomerPrice,
  type Product,
} from '../../api/catalog'
import { kegsApi, type Keg } from '../../api/kegs'
import { salesApi, type SaleDetail, type SaleLineInput } from '../../api/sales'
import { stockApi, type StockRow } from '../../api/stock'
import { useAuth } from '../../auth/AuthContext'
import { Modal, ModalActions } from '../../components/Modal'
import { gbp } from '../../lib/format'
import { errorText, money, nowIso, positiveInt } from '../../lib/stock'
import { availableAt, lotsAt } from '../stock/stockPicking'
import styles from '../stock/Stock.module.css'

interface LineDraft {
  key: string
  productId: string
  qty: string
  /** '' = let the API pick, oldest released first. */
  lotId: string
  /** An admin's override; null = the customer's price. */
  price: string | null
  kegIds: string[]
}

const blankLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  productId: '',
  qty: '1',
  lotId: '',
  price: null,
  kegIds: [],
})

/** The customer's price for a product - their price list, else the product's
 *  default. */
function prefillPrice(productId: string, prices: CustomerPrice[], products: Product[]): string {
  return (
    prices.find((p) => p.product_id === productId)?.unit_price ??
    products.find((p) => p.id === productId)?.default_price ??
    ''
  )
}

/** Filled kegs of this product that are in stock at the location (and of the
 *  chosen lot, if one is). */
function fillableKegs(kegs: Keg[], row: StockRow | undefined, locationId: string, lotId: string): Keg[] {
  const lotIds = new Set(lotsAt(row, locationId).map((l) => l.lot_id))
  return kegs.filter(
    (k) => k.status === 'filled' && k.lot_id != null && lotIds.has(k.lot_id) && (!lotId || k.lot_id === lotId),
  )
}

/** Record a sale: who to, from where, and the lines. Prices come from the
 *  customer's price list and only an admin can change them; keg lines name
 *  the kegs going out. Reviewed before it's confirmed. */
export function NewSaleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (sale: SaleDetail) => void }) {
  const queryClient = useQueryClient()
  const { effectiveRole } = useAuth()
  const isAdmin = effectiveRole === 'admin'

  const customers = useQuery({ queryKey: ['customers'], queryFn: customersApi.list })
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const stock = useQuery({ queryKey: ['stock'], queryFn: stockApi.list })
  const kegs = useQuery({ queryKey: ['kegs'], queryFn: kegsApi.list })

  const [customerId, setCustomerId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine()])
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Minted when the dialog opens and kept for its life, so a confirm retried
  // after a failure can't record the sale twice.
  const [id] = useState(() => crypto.randomUUID())

  const prices = useQuery({
    queryKey: ['customers', customerId, 'prices'],
    queryFn: () => customersApi.prices(customerId),
    enabled: !!customerId,
  })

  const productList = products.data ?? []
  const stockRows = stock.data ?? []
  const priceList = prices.data ?? []
  const productById = new Map(productList.map((p) => [p.id, p]))
  const rowById = new Map(stockRows.map((r) => [r.product_id, r]))
  const sellable = productList.filter(
    (p) => p.status === 'active' && availableAt(rowById.get(p.id), locationId) > 0,
  )

  function update(key: string, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  // Everything the review and the request need, worked out once per render.
  const priced = lines.map((l) => {
    const product = productById.get(l.productId)
    const isKeg = product?.kind === 'keg'
    const units = isKeg ? (l.kegIds.length || null) : positiveInt(l.qty)
    const prefill = l.productId ? prefillPrice(l.productId, priceList, productList) : ''
    const unitPrice = money(l.price ?? prefill)
    const available = availableAt(rowById.get(l.productId), locationId, l.lotId)
    return { ...l, product, isKeg, units, prefill, unitPrice, available }
  })
  const total = priced.reduce((sum, l) => sum + (l.units ?? 0) * Number(l.unitPrice ?? 0), 0)
  const linesValid =
    priced.length > 0 &&
    priced.every((l) => l.product && l.units != null && l.units <= l.available && l.unitPrice != null)
  const valid = !!customerId && !!locationId && !prices.isPending && linesValid

  const save = useMutation({
    mutationFn: () =>
      salesApi.create({
        id,
        customer_id: customerId,
        location_id: locationId,
        sold_at: nowIso(),
        lines: priced.map((l): SaleLineInput => ({
          product_id: l.productId,
          qty: l.units!,
          ...(l.lotId ? { lot_id: l.lotId } : {}),
          // Only an admin's changed price is sent; otherwise the API charges
          // the customer's price itself.
          ...(isAdmin && l.unitPrice != null && l.unitPrice !== money(l.prefill) ? { unit_price: l.unitPrice } : {}),
          ...(l.isKeg ? { container_ids: l.kegIds } : {}),
        })),
      }),
    onSuccess: async (sale) => {
      await Promise.all(
        [['sales'], ['stock'], ['kegs'], ['xero']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      onCreated(sale)
    },
    onError: (e) => setError(errorText(e, 'Could not record the sale')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (step === 'edit') setStep('review')
    else save.mutate()
  }

  const customer = customers.data?.find((c) => c.id === customerId)
  const location = locations.data?.find((l) => l.id === locationId)

  return (
    <Modal
      title={step === 'edit' ? 'New sale' : 'Confirm sale'}
      onClose={onClose}
      dismissable={!save.isPending}
      as="form"
      onSubmit={onSubmit}
      width={680}
    >
      {step === 'edit' ? (
        <>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Customer</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Choose…</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Location</span>
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value)
                  // Lots and kegs belong to the old location; start the lines over.
                  setLines([blankLine()])
                }}
              >
                <option value="">Choose…</option>
                {(locations.data ?? [])
                  .filter((l) => l.status === 'active')
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {customer?.price_list_name && <p className={styles.hint}>Prices from {customer.price_list_name}.</p>}

          {addingCustomer ? (
            <NewCustomerForm
              onCancel={() => setAddingCustomer(false)}
              onCreated={(newId) => {
                setCustomerId(newId)
                setAddingCustomer(false)
              }}
            />
          ) : (
            <div>
              <button type="button" className="text-link" onClick={() => setAddingCustomer(true)}>
                New customer
              </button>
            </div>
          )}

          {priced.map((l, i) => {
            const row = rowById.get(l.productId)
            const lotOptions = lotsAt(row, locationId)
            const kegOptions = l.isKeg ? fillableKegs(kegs.data ?? [], row, locationId, l.lotId) : []
            return (
              <div key={l.key} className={styles.line}>
                <div className={styles.lineHead}>
                  <span>Line {i + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="text-link"
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <IconTrash size={15} stroke={1.9} />
                    </button>
                  )}
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span>Product</span>
                    <select
                      value={l.productId}
                      disabled={!locationId}
                      onChange={(e) => update(l.key, { productId: e.target.value, lotId: '', price: null, kegIds: [] })}
                    >
                      <option value="">{locationId ? 'Choose…' : 'Pick a location first'}</option>
                      {sellable.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Lot</span>
                    <select
                      value={l.lotId}
                      disabled={!l.productId}
                      onChange={(e) => update(l.key, { lotId: e.target.value, kegIds: [] })}
                    >
                      <option value="">Oldest first</option>
                      {lotOptions.map((lot) => (
                        <option key={lot.lot_id} value={lot.lot_id}>
                          {lot.lot_code} ({lot.qty})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span>Quantity</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={l.isKeg ? String(l.kegIds.length) : l.qty}
                      disabled={l.isKeg}
                      onChange={(e) => update(l.key, { qty: e.target.value })}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Unit price (£)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.price ?? l.prefill}
                      disabled={!isAdmin || !l.productId}
                      title={isAdmin ? undefined : 'Only an admin can change a price'}
                      onChange={(e) => update(l.key, { price: e.target.value })}
                    />
                  </label>
                </div>
                {l.isKeg && (
                  <fieldset className={styles.field} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <span>Kegs going out</span>
                    {kegOptions.length === 0 ? (
                      <p className={styles.hint}>No filled kegs of this product here.</p>
                    ) : (
                      <div className={styles.kegList}>
                        {kegOptions.map((k) => (
                          <label key={k.id} className={styles.checkField}>
                            <input
                              type="checkbox"
                              checked={l.kegIds.includes(k.id)}
                              onChange={(e) =>
                                update(l.key, {
                                  kegIds: e.target.checked ? [...l.kegIds, k.id] : l.kegIds.filter((x) => x !== k.id),
                                })
                              }
                            />
                            <span className="mono">
                              {k.lessor} {k.lessor_keg_id}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                )}
                {l.product && l.units != null && l.units > l.available && (
                  <p className={styles.error}>Only {l.available} in stock here.</p>
                )}
              </div>
            )
          })}

          <div>
            <button type="button" className="btn" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              <IconPlus size={16} stroke={2} /> Add line
            </button>
          </div>
        </>
      ) : (
        <div>
          <p className={styles.hint}>
            {customer?.name} · from {location?.name}
          </p>
          {priced.map((l) => (
            <div key={l.key} className={styles.miniRow} style={{ gridTemplateColumns: '1fr 60px 80px 90px' }}>
              <span className={styles.cell}>
                <span className="mono">{l.product?.code}</span>
                <span className={styles.sub}>
                  {l.product?.name}
                  {l.lotId && ` · ${lotsAt(rowById.get(l.productId), locationId).find((x) => x.lot_id === l.lotId)?.lot_code}`}
                </span>
              </span>
              <span className={`mono ${styles.num}`}>× {l.units}</span>
              <span className={`mono ${styles.num}`}>{gbp(l.unitPrice ?? '0')}</span>
              <span className={`mono ${styles.num}`}>{gbp(String((l.units ?? 0) * Number(l.unitPrice ?? 0)))}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.total}>
        <span>Total (ex VAT)</span>
        <span className="mono" aria-label="Running total">
          {gbp(String(total))}
        </span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ModalActions>
        {step === 'review' ? (
          <button type="button" className="btn" onClick={() => setStep('edit')} disabled={save.isPending}>
            Back
          </button>
        ) : (
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={!valid || save.isPending}>
          {step === 'edit' ? 'Review sale' : save.isPending ? 'Saving…' : 'Confirm sale'}
        </button>
      </ModalActions>
    </Modal>
  )
}

/** Add a customer without leaving the sale. Sellers may create customers;
 *  price lists are an admin's call, made later on Manage → Customers. */
function NewCustomerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<CustomerKind>('trade')
  const [error, setError] = useState<string | null>(null)
  // This form remounts for each new customer, so one id per customer.
  const [id] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () =>
      customersApi.create({ id, name: name.trim(), kind, ...(email.trim() ? { email: email.trim() } : {}) }),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      onCreated(c.id)
    },
    onError: (e) => setError(errorText(e, 'Could not add the customer')),
  })

  // A nested <form> isn't allowed inside the dialog's form, so this is a
  // group with its own button rather than a submit.
  return (
    <div
      className={styles.line}
      role="group"
      aria-label="New customer"
      onKeyDown={(e) => {
        // Enter here adds the customer rather than submitting the sale.
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (name.trim() !== '' && !save.isPending) save.mutate()
      }}
    >
      <div className={styles.lineHead}>New customer</div>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as CustomerKind)}>
            <option value="trade">Trade</option>
            <option value="shop">Shop</option>
            <option value="event">Event</option>
          </select>
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.cellActions} style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null)
            save.mutate()
          }}
          disabled={name.trim() === '' || save.isPending}
        >
          {save.isPending ? 'Adding…' : 'Add customer'}
        </button>
        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
