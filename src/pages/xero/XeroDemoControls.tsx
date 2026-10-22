import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { customersApi, productsApi } from '../../api/catalog'
import { salesApi } from '../../api/sales'
import { xeroDevApi, type FailMode } from '../../api/xero'
import { errorText, money, positiveInt } from '../../lib/stock'
import styles from '../stock/Stock.module.css'
import { invalidateXero } from './invalidateXero'

/** Ways to make the stubbed Xero misbehave, or change underneath us, so a
 *  demo can show retries, drift and inbound changes. Only offered when the
 *  API runs against the stub - the API refuses these otherwise. */
export function XeroDemoControls() {
  return (
    <section className={styles.section} aria-label="Demo controls">
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>Demo controls (stubbed Xero only)</h2>
          <p className={styles.note}>These act on the stub as if someone did them in Xero. They never reach a real Xero.</p>
        </div>
      </div>
      <div className={styles.grid2}>
        <FailNext />
        <VoidInvoice />
        <CreditNote />
        <ManualInvoice />
      </div>
    </section>
  )
}

/** A card holding one control, with its own result line. */
function Control({
  title,
  note,
  children,
  action,
}: {
  title: string
  note: string
  children: ReactNode
  action: { label: string; disabled: boolean; mutation: { isPending: boolean; isSuccess: boolean; error: unknown }; run: () => void }
}) {
  const { mutation } = action
  return (
    <div className={`card ${styles.form}`}>
      <div>
        <h3 className={styles.cardTitle} style={{ margin: 0 }}>
          {title}
        </h3>
        <p className={styles.hint}>{note}</p>
      </div>
      {children}
      {mutation.error != null && <p className={styles.error}>{errorText(mutation.error, 'That didn’t work')}</p>}
      <div className={styles.chips} style={{ alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={action.run} disabled={action.disabled || mutation.isPending}>
          {mutation.isPending ? 'Working…' : action.label}
        </button>
        {mutation.isSuccess && <span className="muted">Done</span>}
      </div>
    </div>
  )
}

function useDevMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateXero(queryClient) })
}

function FailNext() {
  const [mode, setMode] = useState<FailMode>('rate_limit')
  const [count, setCount] = useState('1')
  const fail = useDevMutation(() => xeroDevApi.failNext(mode, positiveInt(count)!))
  return (
    <Control
      title="Fail the next calls"
      note="The next N calls to Xero fail this way. Rate limits and server errors retry; validation errors need attention."
      action={{ label: 'Fail next calls', disabled: positiveInt(count) == null, mutation: fail, run: () => fail.mutate(undefined) }}
    >
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>How</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as FailMode)}>
            <option value="rate_limit">Rate limit (429)</option>
            <option value="server_error">Server error (500)</option>
            <option value="validation">Validation (400)</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Calls</span>
          <input type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
      </div>
    </Control>
  )
}

/** Sales that have an invoice in Xero, for the void and credit-note controls. */
function useInvoicedSales() {
  const sales = useQuery({ queryKey: ['sales', 'all'], queryFn: () => salesApi.list() })
  return (sales.data ?? []).filter(
    (s) => s.kind === 'sale' && s.xero.invoice_number != null && s.xero.invoice_status !== 'VOIDED',
  )
}

function SalePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const sales = useInvoicedSales()
  return (
    <label className={styles.field}>
      <span>Sale</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{sales.length ? 'Choose…' : 'No invoiced sales yet'}</option>
        {sales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.reference} · {s.xero.invoice_number} · {s.customer_name}
          </option>
        ))}
      </select>
    </label>
  )
}

function VoidInvoice() {
  const [saleId, setSaleId] = useState('')
  const voidIt = useDevMutation(() => xeroDevApi.voidInvoice(saleId))
  return (
    <Control
      title="Void an invoice in Xero"
      note="As if someone voided it in Xero. The sale picks it up on the next inbound sync."
      action={{ label: 'Void invoice', disabled: !saleId, mutation: voidIt, run: () => voidIt.mutate(undefined) }}
    >
      <SalePicker value={saleId} onChange={setSaleId} />
    </Control>
  )
}

function CreditNote() {
  const [saleId, setSaleId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const sale = useQuery({ queryKey: ['sale', saleId], queryFn: () => salesApi.get(saleId), enabled: !!saleId })
  // A sale line per lot, so one product can appear on several lines.
  const products = [...new Map((sale.data?.lines ?? []).map((l) => [l.product_id, l])).values()]
  const credit = useDevMutation(() => xeroDevApi.creditNote(saleId, [{ product_id: productId, qty: positiveInt(qty)! }]))

  return (
    <Control
      title="Raise a credit note in Xero"
      note="As if a credit note were raised by hand in Xero against the sale's invoice."
      action={{
        label: 'Raise credit note',
        disabled: !saleId || !productId || positiveInt(qty) == null,
        mutation: credit,
        run: () => credit.mutate(undefined),
      }}
    >
      <SalePicker
        value={saleId}
        onChange={(id) => {
          setSaleId(id)
          setProductId('')
        }}
      />
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!sale.data}>
            <option value="">Choose…</option>
            {products.map((l) => (
              <option key={l.product_id} value={l.product_id}>
                {l.product_code} · {l.product_name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Qty</span>
          <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
      </div>
    </Control>
  )
}

interface ManualLine {
  key: string
  productId: string
  qty: string
  price: string
}

const blankManualLine = (): ManualLine => ({ key: crypto.randomUUID(), productId: '', qty: '1', price: '' })

function ManualInvoice() {
  const customers = useQuery({ queryKey: ['customers'], queryFn: customersApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState<ManualLine[]>(() => [blankManualLine()])
  const raise = useDevMutation(() =>
    xeroDevApi.manualInvoice(
      customerId,
      lines.map((l) => ({ product_id: l.productId, qty: positiveInt(l.qty)!, unit_price: money(l.price)! })),
    ),
  )
  const valid =
    !!customerId && lines.every((l) => l.productId && positiveInt(l.qty) != null && money(l.price) != null)
  const update = (key: string, patch: Partial<ManualLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <Control
      title="Add an invoice raised in Xero"
      note="As if someone invoiced in Xero directly. It arrives as an unallocated sale to allocate to a location."
      action={{ label: 'Add invoice', disabled: !valid, mutation: raise, run: () => raise.mutate(undefined) }}
    >
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
      {lines.map((l, i) => (
        <div key={l.key} className={styles.fieldRow} style={{ alignItems: 'end' }}>
          <label className={styles.field}>
            <span>Product</span>
            <select
              value={l.productId}
              onChange={(e) => {
                const p = products.data?.find((x) => x.id === e.target.value)
                update(l.key, { productId: e.target.value, price: l.price || (p?.default_price ?? '') })
              }}
            >
              <option value="">Choose…</option>
              {(products.data ?? [])
                .filter((p) => p.status === 'active')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Qty</span>
            <input type="number" min="1" step="1" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Unit price (£)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={l.price}
              onChange={(e) => update(l.key, { price: e.target.value })}
            />
          </label>
          {lines.length > 1 && (
            <button
              type="button"
              className="text-link"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
              style={{ paddingBottom: 10 }}
            >
              <IconTrash size={15} stroke={1.9} />
            </button>
          )}
        </div>
      ))}
      <div>
        <button type="button" className="text-link" onClick={() => setLines((ls) => [...ls, blankManualLine()])}>
          <IconPlus size={14} stroke={2} /> Add line
        </button>
      </div>
    </Control>
  )
}
