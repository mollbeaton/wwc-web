import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { productsApi, type Product } from '../../api/catalog'
import { makeReferenceListApi } from '../../api/referenceLists'
import { PageHeader } from '../../components/PageHeader'
import { gbp, lotKindLabel } from '../../lib/format'
import { errorText, money } from '../../lib/stock'
import { XeroSyncPill } from '../stock/SyncBadge'
import { ListState } from './ListState'
import styles from './Management.module.css'

const packagingApi = makeReferenceListApi('/packaging')
const GRID = '90px minmax(0, 1.5fr) minmax(0, 1fr) 80px 80px 90px 80px'

/** What's sold: a product is a packaging format of a drink, with a standard
 *  cost and a default price. Each one becomes a tracked item in Xero. */
export function ProductsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [showRetired, setShowRetired] = useState(false)

  const list = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
    ])
  const products = list.data ?? []
  const selected = products.find((p) => p.id === selectedId) ?? null
  const retiredCount = products.filter((p) => p.status === 'retired').length

  const q = query.trim().toLowerCase()
  const visible = products
    .filter((p) => showRetired || p.status === 'active')
    .filter((p) => q === '' || [p.code, p.name, p.packaging_name].some((s) => s.toLowerCase().includes(q)))

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="What’s sold, its cost and default price"
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> Add product
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
            placeholder="Search products"
            aria-label="Search products"
          />
        </div>
      </div>
      <label className={styles.retiredToggle}>
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
        Show retired ({retiredCount})
      </label>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }}>
            <span>Code</span>
            <span>Name</span>
            <span>Packaging</span>
            <span className={styles.num}>Cost</span>
            <span className={styles.num}>Price</span>
            <span>Xero</span>
            <span>Status</span>
          </div>
          {visible.map((p) => (
            <button
              key={p.id}
              className={`${styles.row} ${styles.rowButton} ${p.id === selectedId ? styles.selected : ''}`}
              style={{ gridTemplateColumns: GRID }}
              onClick={() => {
                setSelectedId(p.id)
                setCreating(false)
              }}
            >
              <span className={`mono ${styles.name}`}>{p.code}</span>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.muted}>
                {p.packaging_name} · {lotKindLabel(p.kind)}
              </span>
              <span className={`mono ${styles.num}`}>{gbp(p.standard_cost)}</span>
              <span className={`mono ${styles.num}`}>{gbp(p.default_price)}</span>
              <span>
                <XeroSyncPill sync={p.xero_sync} />
              </span>
              <span className={`pill ${p.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {p.status === 'active' ? 'Active' : 'Retired'}
              </span>
            </button>
          ))}
          <ListState
            isPending={list.isPending}
            isError={list.isError}
            isEmpty={visible.length === 0}
            emptyLabel={products.length === 0 ? 'No products yet.' : 'No matches.'}
            onRetry={() => list.refetch()}
          />
        </div>

        {(creating || selected) && (
          <ProductDetail
            key={selected?.id ?? 'new'}
            product={creating ? null : selected}
            existingCodes={products.map((p) => p.code)}
            onDone={() => {
              setCreating(false)
              void invalidate()
            }}
          />
        )}
      </div>
    </div>
  )
}

function ProductDetail({
  product,
  existingCodes,
  onDone,
}: {
  product: Product | null
  existingCodes: string[]
  onDone: () => void
}) {
  const packaging = useQuery({ queryKey: ['packaging'], queryFn: () => packagingApi.list(true) })
  const [code, setCode] = useState(product?.code ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [packagingId, setPackagingId] = useState(product?.packaging_id ?? '')
  const [cost, setCost] = useState(product?.standard_cost ?? '')
  const [price, setPrice] = useState(product?.default_price ?? '')
  const [error, setError] = useState<string | null>(null)
  // Minted once per panel (it remounts for each new add), reused on retry.
  const [newId] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () =>
      product
        ? productsApi.update(product.id, { name: name.trim(), standard_cost: money(cost)!, default_price: money(price)! })
        : productsApi.create({
            id: newId,
            code: code.trim(),
            name: name.trim(),
            packaging_id: packagingId,
            standard_cost: money(cost)!,
            default_price: money(price)!,
          }),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e, 'Could not save')),
  })
  const status = useMutation({
    mutationFn: () => productsApi.update(product!.id, { status: product!.status === 'active' ? 'retired' : 'active' }),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e, 'Could not change status')),
  })

  const duplicate =
    !product && code.trim() !== '' && existingCodes.some((c) => c.toLowerCase() === code.trim().toLowerCase())
  const valid =
    name.trim() !== '' &&
    money(cost) != null &&
    money(price) != null &&
    (product != null || (code.trim() !== '' && !duplicate && packagingId !== ''))
  const dirty =
    !product || name !== product.name || money(cost) !== product.standard_cost || money(price) !== product.default_price

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{product ? product.code : 'New product'}</h3>
      <form onSubmit={onSubmit} className={styles.form}>
        {!product && (
          <label className={styles.field}>
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
        )}
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {product ? (
          <p className={styles.note}>
            {product.packaging_name} · {product.unit_volume_l} L {lotKindLabel(product.kind).toLowerCase()}
          </p>
        ) : (
          <label className={styles.field}>
            <span>Packaging</span>
            <select value={packagingId} onChange={(e) => setPackagingId(e.target.value)}>
              <option value="">Choose…</option>
              {(packaging.data ?? [])
                .filter((p) => p.status === 'active')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className={styles.field}>
          <span>Standard cost (£)</span>
          <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Default price (£, ex VAT)</span>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>

        {duplicate && <p className={styles.warn}>A product with code “{code.trim()}” already exists.</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : product ? 'Save' : 'Create product'}
        </button>
      </form>

      {product && (
        <div className={styles.actions}>
          <button className="btn" onClick={() => status.mutate()} disabled={status.isPending}>
            {product.status === 'active' ? 'Retire' : 'Restore'}
          </button>
        </div>
      )}
    </div>
  )
}
