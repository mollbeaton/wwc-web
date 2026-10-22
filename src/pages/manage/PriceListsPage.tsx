import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { priceListsApi, productsApi, type PriceList } from '../../api/catalog'
import { Modal, ModalActions } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { gbp } from '../../lib/format'
import { errorText, money } from '../../lib/stock'
import stock from '../stock/Stock.module.css'
import styles from './Management.module.css'

type Drafts = Record<string, Record<string, string>>

/** The list's saved prices, keyed by product. */
function pricesOf(list: PriceList): Record<string, string> {
  return Object.fromEntries(list.items.map((i) => [i.product_id, i.unit_price]))
}

/** Every product down the side, every price list across the top. A blank cell
 *  means the list doesn't name the product, so its customers pay the default. */
export function PriceListsPage() {
  const queryClient = useQueryClient()
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const lists = useQuery({ queryKey: ['price-lists'], queryFn: priceListsApi.list })
  const [drafts, setDrafts] = useState<Drafts>({})
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const active = (products.data ?? []).filter((p) => p.status === 'active')
  const priceLists = lists.data ?? []

  const cell = (list: PriceList, productId: string) => drafts[list.id]?.[productId] ?? pricesOf(list)[productId] ?? ''
  const isDirty = (list: PriceList) => {
    const draft = drafts[list.id]
    if (!draft) return false
    const saved = pricesOf(list)
    return Object.entries(draft).some(([pid, v]) => (money(v) ?? '') !== (saved[pid] ?? ''))
  }
  const isValid = (list: PriceList) =>
    Object.values(drafts[list.id] ?? {}).every((v) => v.trim() === '' || money(v) != null)

  const save = useMutation({
    mutationFn: (list: PriceList) => {
      const merged = { ...pricesOf(list), ...drafts[list.id] }
      const items = Object.entries(merged)
        .filter(([, v]) => v.trim() !== '')
        .map(([product_id, v]) => ({ product_id, unit_price: money(v)! }))
      return priceListsApi.setItems(list.id, items)
    },
    onMutate: (list) => {
      setSavingId(list.id)
      setError(null)
    },
    onSuccess: async (_r, list) => {
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
      setDrafts((d) => {
        const next = { ...d }
        delete next[list.id]
        return next
      })
    },
    onError: (e) => setError(errorText(e, 'Could not save the prices')),
    onSettled: () => setSavingId(null),
  })

  const grid = `minmax(180px, 1.5fr) 90px ${priceLists.map(() => 'minmax(110px, 1fr)').join(' ')}`

  return (
    <div>
      <PageHeader
        title="Price lists"
        subtitle="What each kind of customer pays, ex VAT"
        actions={
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            <IconPlus size={16} stroke={2} /> Add price list
          </button>
        }
      />
      {error && (
        <p className={styles.error} role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div className="card card--flush">
        <div className={stock.scroll} role="table" aria-label="Price lists">
          <div className={`${stock.row} ${stock.head}`} style={{ gridTemplateColumns: grid }} role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader" className={stock.num}>Default</span>
            {priceLists.map((l) => (
              <span role="columnheader" key={l.id} className={stock.cell}>
                {l.name}
                <button
                  type="button"
                  className="text-link"
                  style={{ textTransform: 'none', letterSpacing: 0, alignSelf: 'flex-start' }}
                  onClick={() => save.mutate(l)}
                  disabled={!isDirty(l) || !isValid(l) || savingId != null}
                >
                  {savingId === l.id ? 'Saving…' : isDirty(l) ? 'Save' : 'Saved'}
                </button>
              </span>
            ))}
          </div>
          {active.map((p) => (
            <div key={p.id} className={stock.row} style={{ gridTemplateColumns: grid }} role="row">
              <span role="cell" className={stock.cell}>
                <span className="mono">{p.code}</span>
                <span className={stock.sub}>{p.name}</span>
              </span>
              <span role="cell" className={`mono ${stock.num} muted`}>{gbp(p.default_price)}</span>
              {priceLists.map((l) => (
                <span role="cell" key={l.id}>
                  <input
                    className={stock.input}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Default"
                    aria-label={`${l.name} price for ${p.code}`}
                    value={cell(l, p.id)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [l.id]: { ...d[l.id], [p.id]: e.target.value } }))
                    }
                  />
                </span>
              ))}
            </div>
          ))}
          {(products.isPending || lists.isPending) && <p className={stock.empty}>Loading…</p>}
          {(products.isError || lists.isError) && <p className={stock.empty}>Couldn’t load.</p>}
          {products.data && active.length === 0 && <p className={stock.empty}>No active products yet.</p>}
        </div>
      </div>

      {adding && <AddPriceListModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddPriceListModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [id] = useState(() => crypto.randomUUID())
  const save = useMutation({
    mutationFn: () => priceListsApi.create({ id, name: name.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Modal title="Add price list" onClose={onClose} dismissable={!save.isPending} as="form" onSubmit={onSubmit}>
      <label className={stock.field}>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {save.error && (
        <p className={stock.error} role="alert">
          {errorText(save.error, 'Could not add the price list')}
        </p>
      )}
      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={name.trim() === '' || save.isPending}>
          {save.isPending ? 'Saving…' : 'Add price list'}
        </button>
      </ModalActions>
    </Modal>
  )
}
