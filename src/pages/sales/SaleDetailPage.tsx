import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { salesApi, type SaleDetail } from '../../api/sales'
import { useAuth } from '../../auth/AuthContext'
import { canSell } from '../../auth/roles'
import { BackLink } from '../../components/BackLink'
import { Modal, ModalActions } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { cap, gbp, shortDate } from '../../lib/format'
import { errorText, nowIso } from '../../lib/stock'
import styles from '../stock/Stock.module.css'
import { SALES_POLL_MS } from './SalesPage'
import { XeroChip } from './XeroChip'

const GRID = 'minmax(160px, 1.5fr) 120px 60px 90px 100px 80px'

const STATE_TEXT = {
  queued: 'Waiting to be sent to Xero.',
  sent: 'In Xero.',
  failed: 'Xero rejected it - it will be retried.',
  needs_attention: 'Needs a person: retrying won’t fix it.',
  cancelled: 'Won’t be sent to Xero.',
} as const

/** One sale or return: its lines and the lots they came from, where it is in
 *  Xero, and (for a sale) a Return action. */
export function SaleDetailPage() {
  const { saleId = '' } = useParams()
  const { effectiveRole } = useAuth()
  const navigate = useNavigate()
  const [returning, setReturning] = useState(false)
  const sale = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => salesApi.get(saleId),
    // Keep polling while Xero hasn't settled, so queued → sent shows up.
    refetchInterval: (q) => (q.state.data?.xero.state === 'queued' ? SALES_POLL_MS : false),
  })

  const back = <BackLink fallbackTo="/sales" fallbackLabel="Sales" />

  if (sale.isPending) return <div aria-busy="true">{back}<p className="muted">Loading…</p></div>
  if (sale.isError) {
    return (
      <div>
        {back}
        <p className={styles.error}>{errorText(sale.error, 'Could not load the sale')}</p>
      </div>
    )
  }

  const s = sale.data
  const returnable = s.lines.some((l) => l.qty > l.returned_qty)
  const canReturn = canSell(effectiveRole) && s.kind === 'sale' && s.status === 'confirmed' && returnable

  return (
    <div>
      {back}
      <PageHeader
        title={s.reference}
        subtitle={`${s.kind === 'return' ? 'Return' : 'Sale'} to ${s.customer_name}`}
        actions={
          canReturn && (
            <button className="btn" onClick={() => setReturning(true)}>
              Return
            </button>
          )
        }
      />

      <div className={styles.facts}>
        <Fact label="Total (ex VAT)" value={gbp(s.total)} mono />
        <Fact label="Date" value={shortDate(s.sold_at)} />
        <Fact label="Location" value={s.location_name ?? '—'} sub={s.status === 'unallocated' ? 'Not allocated yet' : undefined} />
        <Fact label="Status" value={cap(s.status)} />
      </div>

      {s.returns_sale_id && (
        <p className={styles.note} style={{ marginBottom: 16 }}>
          Returns stock from{' '}
          <Link to={`/sales/${s.returns_sale_id}`} className="text-link">
            the original sale
          </Link>
          .
        </p>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 className={styles.cardTitle}>Xero</h2>
        <div className={styles.chips} style={{ alignItems: 'center', gap: 10 }}>
          <XeroChip xero={s.xero} />
          <span className="muted">{STATE_TEXT[s.xero.state]}</span>
        </div>
        {s.xero.last_error && <p className={styles.error} style={{ marginTop: 8 }}>{s.xero.last_error}</p>}
      </div>

      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Lines">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader">Lot</span>
            <span role="columnheader" className={styles.num}>Qty</span>
            <span role="columnheader" className={styles.num}>Price</span>
            <span role="columnheader" className={styles.num}>Line total</span>
            <span role="columnheader" className={styles.num}>Returned</span>
          </div>
          {s.lines.map((l) => (
            <div key={l.id} className={styles.row} style={{ gridTemplateColumns: GRID }} role="row">
              <span role="cell" className={styles.cell}>
                <span className="mono">{l.product_code}</span>
                <span className={styles.sub}>
                  {l.product_name}
                  {l.container_ids.length > 0 && ` · ${l.container_ids.length} keg${l.container_ids.length === 1 ? '' : 's'}`}
                </span>
              </span>
              <span role="cell">
                {l.lot_id ? (
                  <Link to={`/lots/${l.lot_id}`} className="mono text-link">
                    {l.lot_code}
                  </Link>
                ) : (
                  <span className="muted">—</span>
                )}
              </span>
              <span role="cell" className={`mono ${styles.num}`}>{l.qty}</span>
              <span role="cell" className={`mono ${styles.num}`}>{gbp(l.unit_price)}</span>
              <span role="cell" className={`mono ${styles.num}`}>{gbp(l.line_total)}</span>
              <span role="cell" className={`mono ${styles.num}`}>{l.returned_qty || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {returning && (
        <ReturnModal
          sale={s}
          onClose={() => setReturning(false)}
          onCreated={(ret) => {
            setReturning(false)
            navigate(`/sales/${ret.id}`)
          }}
        />
      )}
    </div>
  )
}

function ReturnModal({
  sale,
  onClose,
  onCreated,
}: {
  sale: SaleDetail
  onClose: () => void
  onCreated: (ret: SaleDetail) => void
}) {
  const queryClient = useQueryClient()
  const lines = sale.lines.filter((l) => l.qty > l.returned_qty)
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  // One id per return, kept across retries.
  const [id] = useState(() => crypto.randomUUID())

  const picked = lines
    .map((l) => ({ line: l, qty: Number(qtys[l.id] ?? '') }))
    .filter((p) => (qtys[p.line.id] ?? '').trim() !== '')
  const valid =
    picked.length > 0 &&
    picked.every((p) => Number.isInteger(p.qty) && p.qty > 0 && p.qty <= p.line.qty - p.line.returned_qty)

  const save = useMutation({
    mutationFn: () =>
      salesApi.createReturn(sale.id, {
        id,
        occurred_at: nowIso(),
        lines: picked.map((p) => ({ sale_line_id: p.line.id, qty: p.qty })),
      }),
    onSuccess: async (ret) => {
      await Promise.all(
        [['sales'], ['sale', sale.id], ['stock'], ['kegs'], ['xero']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      onCreated(ret)
    },
    onError: (e) => setError(errorText(e, 'Could not record the return')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <Modal
      title={`Return from ${sale.reference}`}
      onClose={onClose}
      dismissable={!save.isPending}
      as="form"
      onSubmit={onSubmit}
      width={560}
    >
      <p className={styles.hint}>Units come back into stock at {sale.location_name ?? 'the sale’s location'}.</p>
      {lines.map((l) => {
        const left = l.qty - l.returned_qty
        return (
          <div key={l.id} className={styles.miniRow} style={{ gridTemplateColumns: '1fr 90px 90px' }}>
            <span className={styles.cell}>
              <span className="mono">{l.product_code}</span>
              <span className={styles.sub}>
                {l.lot_code ?? ''} · {left} returnable
              </span>
            </span>
            <span className={`mono ${styles.num}`}>{gbp(l.unit_price)}</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              max={left}
              step="1"
              aria-label={`Return ${l.product_code} ${l.lot_code ?? ''}`.trim()}
              value={qtys[l.id] ?? ''}
              onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })}
            />
          </div>
        )
      })}
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
          {save.isPending ? 'Saving…' : 'Record return'}
        </button>
      </ModalActions>
    </Modal>
  )
}

function Fact({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className={styles.fact}>
      <div className={styles.factLabel}>{label}</div>
      <div className={`${mono ? 'mono ' : ''}${styles.factValue}`}>{value}</div>
      {sub && <div className={styles.factSub}>{sub}</div>}
    </div>
  )
}
