import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { locationsApi, type LocationKind, type StockLocation } from '../../api/catalog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageHeader } from '../../components/PageHeader'
import { cap } from '../../lib/format'
import { errorText } from '../../lib/stock'
import { ListState } from './ListState'
import styles from './Management.module.css'

const GRID = 'minmax(0, 1.6fr) 100px 90px 150px'

/** Where stock is held: the cellar, the shop, and events. An event is
 *  normally closed by its close-out (count, write-offs, takings); plain Close
 *  is for an event that never happened. */
export function LocationsPage() {
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: ['locations'], queryFn: locationsApi.list })
  const [closing, setClosing] = useState<StockLocation | null>(null)
  // Bumped after each add, so the form remounts with a fresh id.
  const [formKey, setFormKey] = useState(0)
  const locations = list.data ?? []

  const close = useMutation({
    mutationFn: (l: StockLocation) => locationsApi.close(l.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      setClosing(null)
    },
  })

  return (
    <div>
      <PageHeader title="Locations" subtitle="Where stock is held - the cellar, the shop and events" />

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }}>
            <span>Name</span>
            <span>Kind</span>
            <span>Status</span>
            <span />
          </div>
          {locations.map((l) => (
            <div key={l.id} className={styles.row} style={{ gridTemplateColumns: GRID, borderBottom: '1px solid var(--border)' }}>
              <span className={styles.name}>{l.name}</span>
              <span className={styles.muted}>{cap(l.kind)}</span>
              <span className={`pill ${l.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {l.status === 'active' ? 'Active' : 'Closed'}
              </span>
              <span className={styles.num}>
                {l.kind === 'event' && l.status === 'active' && (
                  <span style={{ display: 'inline-flex', gap: 12 }}>
                    <Link to={`/stock/events/${l.id}/close-out`} className="text-link">
                      Close out
                    </Link>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        close.reset()
                        setClosing(l)
                      }}
                    >
                      Close
                    </button>
                  </span>
                )}
              </span>
            </div>
          ))}
          <ListState
            isPending={list.isPending}
            isError={list.isError}
            isEmpty={locations.length === 0}
            emptyLabel="No locations yet."
            onRetry={() => list.refetch()}
          />
        </div>

        <AddLocation key={formKey} onDone={() => setFormKey((k) => k + 1)} />
      </div>

      {closing && (
        <ConfirmDialog
          title={`Close ${closing.name}?`}
          confirmLabel="Close event"
          pendingLabel="Closing…"
          pending={close.isPending}
          error={close.error ? errorText(close.error, 'Could not close the location') : null}
          onConfirm={() => close.mutate(closing)}
          onCancel={() => setClosing(null)}
        >
          <p>It stops taking stock and sales. Transfer anything left there back first.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

function AddLocation({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LocationKind>('event')
  const [id] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () => locationsApi.create({ id, name: name.trim(), kind }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      onDone()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>Add location</h3>
      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
            <option value="event">Event</option>
            <option value="shop">Shop</option>
            <option value="cellar">Cellar</option>
          </select>
        </label>
        {save.error && <p className={styles.error}>{errorText(save.error, 'Could not add the location')}</p>}
        <button type="submit" className="btn btn--primary" disabled={name.trim() === '' || save.isPending}>
          {save.isPending ? 'Saving…' : 'Add location'}
        </button>
      </form>
    </div>
  )
}
