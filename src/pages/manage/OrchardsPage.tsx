import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { orchardsApi, type Orchard, type OrchardInput } from '../../api/management'
import { ChangeLog } from '../../components/ChangeLog'
import { PageHeader } from '../../components/PageHeader'
import styles from './Management.module.css'

const BLANK: OrchardInput = { name: '', location: '', grower: '', notes: '' }

export function OrchardsPage() {
  const queryClient = useQueryClient()
  const [showRetired, setShowRetired] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const list = useQuery({
    queryKey: ['orchards', showRetired],
    queryFn: () => orchardsApi.list(showRetired),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orchards'] })
  const orchards = list.data ?? []
  const retiredCount = orchards.filter((o) => o.status === 'retired').length
  const selected = orchards.find((o) => o.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const visible = orchards.filter((o) =>
    q === '' || [o.name, o.location, o.grower].some((v) => (v ?? '').toLowerCase().includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Orchards"
        subtitle="Where the fruit is grown"
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> Add orchard
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
            placeholder="Search orchards"
            aria-label="Search orchards"
          />
        </div>
      </div>

      <label className={styles.retiredToggle}>
        <input
          type="checkbox"
          checked={showRetired}
          onChange={(e) => setShowRetired(e.target.checked)}
        />
        Show retired{!showRetired && retiredCount === 0 ? '' : ` (${retiredCount})`}
      </label>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`}>
            <span>Name</span>
            <span>Location</span>
            <span>Grower</span>
            <span className={styles.num}>Used</span>
            <span>Status</span>
          </div>
          {visible.map((o) => (
            <button
              key={o.id}
              className={`${styles.row} ${styles.rowButton} ${o.id === selectedId ? styles.selected : ''}`}
              onClick={() => {
                setSelectedId(o.id)
                setCreating(false)
              }}
            >
              <span className={styles.name}>{o.name}</span>
              <span className={styles.muted}>{o.location ?? '—'}</span>
              <span className={styles.muted}>{o.grower ?? '—'}</span>
              <span className={`mono ${styles.num}`}>{o.used_count}</span>
              <span className={`pill ${o.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {o.status === 'active' ? 'Active' : 'Retired'}
              </span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className={styles.empty}>{orchards.length === 0 ? 'No orchards yet.' : 'No matches.'}</p>
          )}
        </div>

        {(creating || selected) && (
          <OrchardDetail
            key={selected?.id ?? 'new'}
            orchard={creating ? null : selected}
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

function OrchardDetail({
  orchard,
  onDone,
  onDeleted,
}: {
  orchard: Orchard | null
  onDone: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState<OrchardInput>(
    orchard
      ? { name: orchard.name, location: orchard.location, grower: orchard.grower, notes: orchard.notes }
      : BLANK,
  )
  const [error, setError] = useState<string | null>(null)

  const changeLog = useQuery({
    queryKey: ['orchards', orchard?.id, 'change-log'],
    queryFn: () => orchardsApi.changeLog(orchard!.id),
    enabled: !!orchard,
  })

  const save = useMutation({
    mutationFn: (body: OrchardInput) =>
      orchard ? orchardsApi.update(orchard.id, body) : orchardsApi.create(body),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const retire = useMutation({
    mutationFn: () => (orchard!.status === 'active' ? orchardsApi.retire(orchard!.id) : orchardsApi.restore(orchard!.id)),
    onSuccess: onDone,
  })
  const remove = useMutation({
    mutationFn: () => orchardsApi.remove(orchard!.id),
    onSuccess: onDeleted,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not delete'),
  })

  const dirty =
    !orchard ||
    form.name !== orchard.name ||
    (form.location ?? '') !== (orchard.location ?? '') ||
    (form.grower ?? '') !== (orchard.grower ?? '') ||
    (form.notes ?? '') !== (orchard.notes ?? '')
  const valid = (form.name ?? '').trim().length > 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate(form)
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{orchard ? orchard.name : 'New orchard'}</h3>

      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="Name" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
        <Field
          label="Location"
          value={form.location ?? ''}
          onChange={(v) => setForm({ ...form, location: v })}
        />
        <Field
          label="Grower"
          value={form.grower ?? ''}
          onChange={(v) => setForm({ ...form, grower: v })}
        />
        <Field
          label="Notes"
          value={form.notes ?? ''}
          onChange={(v) => setForm({ ...form, notes: v })}
          textarea
        />

        <p className={styles.note}>
          A name change shows in past records too. If this is a different orchard, not a renamed one,
          add a new one instead.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {orchard && (
        <>
          <div className={styles.actions}>
            <button className="btn" onClick={() => retire.mutate()} disabled={retire.isPending}>
              {orchard.status === 'active' ? 'Retire' : 'Restore'}
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => remove.mutate()}
              disabled={orchard.used_count > 0 || remove.isPending}
              title={orchard.used_count > 0 ? 'Used by a harvest — retire it instead' : 'Delete'}
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

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  textarea?: boolean
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
