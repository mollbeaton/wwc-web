import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { customersApi, priceListsApi, type Customer, type CustomerKind } from '../../api/catalog'
import { PageHeader } from '../../components/PageHeader'
import { cap } from '../../lib/format'
import { errorText } from '../../lib/stock'
import { XeroSyncPill } from '../stock/SyncBadge'
import { ListState } from './ListState'
import styles from './Management.module.css'

const GRID = 'minmax(0, 1.3fr) minmax(0, 1.4fr) 70px minmax(0, 1fr) 90px'

/** Who's sold to, and which price list they pay. Each customer becomes a
 *  contact in Xero. */
export function CustomersPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const list = useQuery({ queryKey: ['customers'], queryFn: customersApi.list })
  const customers = list.data ?? []
  const selected = customers.find((c) => c.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const visible = customers.filter(
    (c) => q === '' || [c.name, c.email, c.price_list_name].some((s) => (s ?? '').toLowerCase().includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Who’s sold to, and the prices they pay"
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> Add customer
          </button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <IconSearch size={16} stroke={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers"
            aria-label="Search customers"
          />
        </div>
      </div>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }}>
            <span>Name</span>
            <span>Email</span>
            <span>Kind</span>
            <span>Price list</span>
            <span>Xero</span>
          </div>
          {visible.map((c) => (
            <button
              key={c.id}
              className={`${styles.row} ${styles.rowButton} ${c.id === selectedId ? styles.selected : ''}`}
              style={{ gridTemplateColumns: GRID }}
              onClick={() => {
                setSelectedId(c.id)
                setCreating(false)
              }}
            >
              <span className={styles.name}>{c.name}</span>
              <span className={styles.muted}>{c.email ?? '—'}</span>
              <span>{cap(c.kind)}</span>
              <span className={styles.muted}>{c.price_list_name ?? 'Default prices'}</span>
              <span>
                <XeroSyncPill sync={c.xero_sync} />
              </span>
            </button>
          ))}
          <ListState
            isPending={list.isPending}
            isError={list.isError}
            isEmpty={visible.length === 0}
            emptyLabel={customers.length === 0 ? 'No customers yet.' : 'No matches.'}
            onRetry={() => list.refetch()}
          />
        </div>

        {(creating || selected) && (
          <CustomerDetail
            key={selected?.id ?? 'new'}
            customer={creating ? null : selected}
            onDone={() => {
              setCreating(false)
              void queryClient.invalidateQueries({ queryKey: ['customers'] })
            }}
          />
        )}
      </div>
    </div>
  )
}

function CustomerDetail({ customer, onDone }: { customer: Customer | null; onDone: () => void }) {
  const priceLists = useQuery({ queryKey: ['price-lists'], queryFn: priceListsApi.list })
  const [name, setName] = useState(customer?.name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [kind, setKind] = useState<CustomerKind>(customer?.kind ?? 'trade')
  const [priceListId, setPriceListId] = useState(customer?.price_list_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [newId] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () =>
      customer
        ? customersApi.update(customer.id, {
            email: email.trim() || null,
            kind,
            price_list_id: priceListId || null,
          })
        : customersApi.create({
            id: newId,
            name: name.trim(),
            kind,
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(priceListId ? { price_list_id: priceListId } : {}),
          }),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e, 'Could not save')),
  })

  const dirty =
    !customer ||
    email !== (customer.email ?? '') ||
    kind !== customer.kind ||
    priceListId !== (customer.price_list_id ?? '')
  const valid = customer != null || name.trim() !== ''

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{customer ? customer.name : 'New customer'}</h3>
      <form onSubmit={onSubmit} className={styles.form}>
        {!customer && (
          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
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
        <label className={styles.field}>
          <span>Price list</span>
          <select value={priceListId} onChange={(e) => setPriceListId(e.target.value)}>
            <option value="">Default prices</option>
            {(priceLists.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {customer?.xero_contact_id && <p className={styles.note}>Xero contact {customer.xero_contact_id}</p>}
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : customer ? 'Save' : 'Create customer'}
        </button>
      </form>
    </div>
  )
}
