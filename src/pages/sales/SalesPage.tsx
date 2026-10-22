import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { locationsApi } from '../../api/catalog'
import { salesApi, type SaleStatus, type SaleSummary } from '../../api/sales'
import { useAuth } from '../../auth/AuthContext'
import { canSell } from '../../auth/roles'
import { Modal, ModalActions } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import { gbp, shortDate } from '../../lib/format'
import { errorText } from '../../lib/stock'
import styles from '../stock/Stock.module.css'
import { NewSaleModal } from './NewSaleModal'
import { XeroChip } from './XeroChip'

/** How often the list re-polls, so a demo shows invoices go queued → sent. */
export const SALES_POLL_MS = 4000

const GRID = '130px minmax(140px, 1.4fr) minmax(110px, 1fr) 100px 90px minmax(150px, 1fr) 90px'

type Filter = 'all' | SaleStatus

export function SalesPage() {
  const { effectiveRole } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [allocating, setAllocating] = useState<SaleSummary | null>(null)

  const sales = useQuery({
    queryKey: ['sales', filter],
    queryFn: () => salesApi.list(filter === 'all' ? undefined : filter),
    refetchInterval: SALES_POLL_MS,
  })
  const rows = sales.data ?? []

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Sales and returns, and where each one is in Xero"
        actions={
          canSell(effectiveRole) && (
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              <IconPlus size={16} stroke={2} /> New sale
            </button>
          )
        }
      />

      <div className={styles.toolbar}>
        <Segmented
          label="Show"
          options={[
            { value: 'all', label: 'All' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'unallocated', label: 'Unallocated (raised in Xero)' },
            { value: 'voided', label: 'Voided' },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </div>
      {filter === 'unallocated' && (
        <p className={styles.note} style={{ marginBottom: 14 }}>
          Invoices raised by hand in Xero. Allocate each to the location the stock left from, and its lots are
          picked oldest first.
        </p>
      )}

      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Sales">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Reference</span>
            <span role="columnheader">Customer</span>
            <span role="columnheader">Location</span>
            <span role="columnheader">Date</span>
            <span role="columnheader" className={styles.num}>Total</span>
            <span role="columnheader">Xero</span>
            <span role="columnheader" />
          </div>
          {rows.map((s) => (
            <div key={s.id} className={`${styles.row} ${styles.linkRow}`} style={{ gridTemplateColumns: GRID }} role="row">
              <span role="cell" className={styles.cell}>
                <Link to={`/sales/${s.id}`} className={`mono ${styles.strong}`}>
                  {s.reference}
                </Link>
                <span className={styles.sub}>
                  {s.kind === 'return' ? 'Return' : 'Sale'}
                  {s.status !== 'confirmed' && ` · ${s.status === 'voided' ? 'Voided' : 'Unallocated'}`}
                </span>
              </span>
              <span role="cell">{s.customer_name}</span>
              <span role="cell" className="muted">{s.location_name ?? '—'}</span>
              <span role="cell" className="muted">{shortDate(s.sold_at)}</span>
              <span role="cell" className={`mono ${styles.num}`}>{gbp(s.total)}</span>
              <span role="cell">
                <XeroChip xero={s.xero} />
              </span>
              <span role="cell" className={styles.cellActions}>
                {s.status === 'unallocated' && canSell(effectiveRole) && (
                  <button type="button" className="text-link" onClick={() => setAllocating(s)}>
                    Allocate
                  </button>
                )}
              </span>
            </div>
          ))}
          {sales.isPending && <p className={styles.empty}>Loading…</p>}
          {sales.isError && (
            <p className={styles.empty}>
              {errorText(sales.error, 'Couldn’t load sales.')}{' '}
              <button type="button" className="text-link" onClick={() => sales.refetch()}>
                Retry
              </button>
            </p>
          )}
          {sales.data && rows.length === 0 && (
            <p className={styles.empty}>{filter === 'all' ? 'No sales yet.' : 'Nothing here.'}</p>
          )}
        </div>
      </div>

      {creating && (
        <NewSaleModal onClose={() => setCreating(false)} onCreated={(sale) => navigate(`/sales/${sale.id}`)} />
      )}
      {allocating && <AllocateModal sale={allocating} onClose={() => setAllocating(null)} />}
    </div>
  )
}

/** Tie a sale raised directly in Xero to the location its stock left from. */
function AllocateModal({ sale, onClose }: { sale: SaleSummary; onClose: () => void }) {
  const queryClient = useQueryClient()
  const locations = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const [locationId, setLocationId] = useState('')

  const allocate = useMutation({
    mutationFn: () => salesApi.allocate(sale.id, locationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ])
      onClose()
    },
  })

  return (
    <Modal title={`Allocate ${sale.reference}`} onClose={onClose} dismissable={!allocate.isPending}>
      <p className={styles.hint}>
        {sale.customer_name} · {gbp(sale.total)}
        {sale.xero.invoice_number && ` · Xero ${sale.xero.invoice_number}`}
      </p>
      <label className={styles.field}>
        <span>Location</span>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
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
      {allocate.error && (
        <p className={styles.error} role="alert">
          {errorText(allocate.error, 'Could not allocate the sale')}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onClose} disabled={allocate.isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => allocate.mutate()}
          disabled={!locationId || allocate.isPending}
        >
          {allocate.isPending ? 'Allocating…' : 'Allocate'}
        </button>
      </ModalActions>
    </Modal>
  )
}
