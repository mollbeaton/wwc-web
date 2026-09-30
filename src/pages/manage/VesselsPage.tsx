import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { VESSEL_TYPES, vesselsApi, type Vessel, type VesselInput } from '../../api/vessels'
import { ChangeLog } from '../../components/ChangeLog'
import { PageHeader } from '../../components/PageHeader'
import { fixed } from '../../lib/format'
import { ListState } from './ListState'
import styles from './Management.module.css'

const BLANK: VesselInput = { code: '', name: '', capacity_l: '', type: 'tank' }

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function VesselsPage() {
  const queryClient = useQueryClient()
  const [showRetired, setShowRetired] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const list = useQuery({ queryKey: ['vessels'], queryFn: vesselsApi.list })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vessels'] })

  const all = list.data ?? []
  const retiredCount = all.filter((v) => v.status === 'retired').length
  const byStatus = showRetired ? all : all.filter((v) => v.status === 'active')
  const selected = all.find((v) => v.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const vessels = byStatus.filter((v) =>
    q === '' || [v.code, v.name, v.type].some((s) => (s ?? '').toLowerCase().includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Vessels"
        subtitle="Tanks, barrels and other vessels the iOS app records against"
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> Add vessel
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
            placeholder="Search vessels"
            aria-label="Search vessels"
          />
        </div>
      </div>

      <label className={styles.retiredToggle}>
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
        Show retired ({retiredCount})
      </label>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`}>
            <span>Name</span>
            <span>Type</span>
            <span>Capacity</span>
            <span className={styles.num}>Used</span>
            <span>Status</span>
          </div>
          {vessels.map((v) => (
            <button
              key={v.id}
              className={`${styles.row} ${styles.rowButton} ${v.id === selectedId ? styles.selected : ''}`}
              onClick={() => {
                setSelectedId(v.id)
                setCreating(false)
              }}
            >
              <span className={styles.name}>
                {v.code}
                {v.name ? ` · ${v.name}` : ''}
              </span>
              <span className={styles.muted}>{cap(v.type)}</span>
              <span className="mono">{fixed(v.capacity_l, 0)} L</span>
              <span className={`mono ${styles.num}`}>{v.used_count}</span>
              <span className={`pill ${v.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {v.status === 'active' ? 'Active' : 'Retired'}
              </span>
            </button>
          ))}
          <ListState
            isPending={list.isPending}
            isError={list.isError}
            isEmpty={vessels.length === 0}
            emptyLabel={byStatus.length === 0 ? 'No vessels.' : 'No matches.'}
            onRetry={() => list.refetch()}
          />
        </div>

        {(creating || selected) && (
          <VesselDetail
            key={selected?.id ?? 'new'}
            vessel={creating ? null : selected}
            onDone={() => {
              setCreating(false)
              invalidate()
            }}
            onDeleted={() => {
              setCreating(false)
              setSelectedId(null)
              invalidate()
            }}
          />
        )}
      </div>
    </div>
  )
}

function VesselDetail({
  vessel,
  onDone,
  onDeleted,
}: {
  vessel: Vessel | null
  onDone: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState<VesselInput>(
    vessel
      ? { code: vessel.code, name: vessel.name, capacity_l: vessel.capacity_l, type: vessel.type }
      : BLANK,
  )
  const [error, setError] = useState<string | null>(null)
  const holdsLot = (vessel?.current_lot_ids.length ?? 0) > 0

  const changeLog = useQuery({
    queryKey: ['vessels', vessel?.id, 'change-log'],
    queryFn: () => vesselsApi.changeLog(vessel!.id),
    enabled: !!vessel,
  })

  const save = useMutation({
    mutationFn: (body: VesselInput) =>
      vessel ? vesselsApi.update(vessel.id, body) : vesselsApi.create(body),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const retire = useMutation({
    mutationFn: () => (vessel!.status === 'active' ? vesselsApi.retire(vessel!.id) : vesselsApi.restore(vessel!.id)),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not change status'),
  })
  const remove = useMutation({
    mutationFn: () => vesselsApi.remove(vessel!.id),
    onSuccess: onDeleted,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not delete'),
  })

  const dirty =
    !vessel ||
    form.code !== vessel.code ||
    (form.name ?? '') !== (vessel.name ?? '') ||
    form.capacity_l !== vessel.capacity_l ||
    form.type !== vessel.type
  const valid = (form.code ?? '').trim().length > 0 && Number(form.capacity_l) > 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate(form)
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{vessel ? vessel.code : 'New vessel'}</h3>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}>
          <span>Code</span>
          <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Name</span>
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Capacity (L)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={form.capacity_l ?? ''}
            onChange={(e) => setForm({ ...form, capacity_l: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {VESSEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {cap(t)}
              </option>
            ))}
          </select>
        </label>

        <p className={styles.note}>
          A rename shows in past records too, since history is kept against the vessel's ID.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {vessel && (
        <>
          <div className={styles.actions}>
            <button
              className="btn"
              onClick={() => retire.mutate()}
              disabled={(vessel.status === 'active' && holdsLot) || retire.isPending}
              title={vessel.status === 'active' && holdsLot ? 'Holds a lot — empty it first' : ''}
            >
              {vessel.status === 'active' ? 'Retire' : 'Restore'}
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => remove.mutate()}
              disabled={vessel.used_count > 0 || remove.isPending}
              title={vessel.used_count > 0 ? 'Has held a lot — retire it instead' : 'Delete'}
            >
              Delete
            </button>
          </div>

          <div className={styles.logSection}>
            <h4 className={styles.logTitle}>Change log</h4>
            <ChangeLog entries={changeLog.data ?? []} />
          </div>
        </>
      )}
    </div>
  )
}
