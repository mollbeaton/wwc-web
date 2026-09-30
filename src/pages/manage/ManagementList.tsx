import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import type { RefBody, RefItem, ReferenceListApi } from '../../api/referenceLists'
import { ChangeLog } from '../../components/ChangeLog'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import styles from './Management.module.css'

export interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
}

export interface ColumnConfig {
  key: string
  label: string
  render?: (item: RefItem) => ReactNode
}

export interface ManagementListConfig {
  title: string
  subtitle: string
  addLabel: string
  queryKey: string
  api: ReferenceListApi
  columns: ColumnConfig[]
  fields: FieldConfig[]
  /** Grid template for the table rows, matching columns + status. */
  gridTemplate: string
  /** Key of a select field to offer as a category filter (e.g. 'fruit').
   * Its options drive the filter; omit for search-only pages. */
  filterField?: string
}

function blankFrom(fields: FieldConfig[]): RefBody {
  const body: RefBody = {}
  for (const f of fields) {
    if (f.type === 'checkbox') body[f.key] = false
    // A select must default to its first option: a controlled <select> with a
    // value matching no <option> shows the first one but leaves state empty,
    // so an untouched dropdown would submit "" (422 on a required field).
    else if (f.type === 'select') body[f.key] = f.options?.[0]?.value ?? ''
    else body[f.key] = ''
  }
  return body
}

export function ManagementList({ config }: { config: ManagementListConfig }) {
  const queryClient = useQueryClient()
  const [showRetired, setShowRetired] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [filterValue, setFilterValue] = useState('all')

  const list = useQuery({
    queryKey: [config.queryKey, showRetired],
    queryFn: () => config.api.list(showRetired),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] })

  const items = list.data ?? []
  const retiredCount = items.filter((i) => i.status === 'retired').length
  const selected = items.find((i) => i.id === selectedId) ?? null

  // A select field, when named, doubles as a category filter (its options + All).
  const filterConfig = config.filterField
    ? config.fields.find((f) => f.key === config.filterField)
    : undefined
  const q = query.trim().toLowerCase()
  const visible = items.filter((item) => {
    if (filterConfig && filterValue !== 'all' && String(item[filterConfig.key] ?? '') !== filterValue) {
      return false
    }
    return q === '' || String(item.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> {config.addLabel}
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
            placeholder={`Search ${config.title.toLowerCase()}`}
            aria-label={`Search ${config.title.toLowerCase()}`}
          />
        </div>
        {filterConfig && (
          <Segmented
            label={filterConfig.label}
            options={[{ value: 'all', label: 'All' }, ...(filterConfig.options ?? [])]}
            value={filterValue}
            onChange={setFilterValue}
          />
        )}
      </div>

      <label className={styles.retiredToggle}>
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
        Show retired ({retiredCount})
      </label>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: config.gridTemplate }}>
            {config.columns.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
            <span>Status</span>
          </div>
          {visible.map((item) => (
            <button
              key={item.id}
              className={`${styles.row} ${styles.rowButton} ${item.id === selectedId ? styles.selected : ''}`}
              style={{ gridTemplateColumns: config.gridTemplate }}
              onClick={() => {
                setSelectedId(item.id)
                setCreating(false)
              }}
            >
              {config.columns.map((c, i) => (
                <span key={c.key} className={i === 0 ? styles.name : styles.muted}>
                  {c.render ? c.render(item) : String(item[c.key] ?? '—')}
                </span>
              ))}
              <span className={`pill ${item.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {item.status === 'active' ? 'Active' : 'Retired'}
              </span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className={styles.empty}>{items.length === 0 ? 'Nothing here yet.' : 'No matches.'}</p>
          )}
        </div>

        {(creating || selected) && (
          <Detail
            key={selected?.id ?? 'new'}
            config={config}
            item={creating ? null : selected}
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

function Detail({
  config,
  item,
  onDone,
  onDeleted,
}: {
  config: ManagementListConfig
  item: RefItem | null
  onDone: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState<RefBody>(() => {
    if (!item) return blankFrom(config.fields)
    const body: RefBody = {}
    for (const f of config.fields) body[f.key] = item[f.key] ?? (f.type === 'checkbox' ? false : '')
    return body
  })
  const [error, setError] = useState<string | null>(null)

  const changeLog = useQuery({
    queryKey: [config.queryKey, item?.id, 'change-log'],
    queryFn: () => config.api.changeLog(item!.id),
    enabled: !!item,
  })

  const save = useMutation({
    mutationFn: (body: RefBody) => (item ? config.api.update(item.id, body) : config.api.create(body)),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const retire = useMutation({
    mutationFn: () => (item!.status === 'active' ? config.api.retire(item!.id) : config.api.restore(item!.id)),
    onSuccess: onDone,
  })
  const remove = useMutation({
    mutationFn: () => config.api.remove(item!.id),
    onSuccess: onDeleted,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not delete'),
  })

  const dirty =
    !item || config.fields.some((f) => (form[f.key] ?? '') !== (item[f.key] ?? (f.type === 'checkbox' ? false : '')))
  const valid = String(form.name ?? '').trim().length > 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate(form)
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{item ? String(item.name) : `New ${config.addLabel.replace(/^Add /i, '').toLowerCase()}`}</h3>

      <form onSubmit={onSubmit} className={styles.form}>
        {config.fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={form[f.key]}
            onChange={(v) => setForm({ ...form, [f.key]: v })}
          />
        ))}

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {item && (
        <>
          <div className={styles.actions}>
            <button className="btn" onClick={() => retire.mutate()} disabled={retire.isPending}>
              {item.status === 'active' ? 'Retire' : 'Restore'}
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => remove.mutate()}
              disabled={item.used_count > 0 || remove.isPending}
              title={item.used_count > 0 ? 'In use — retire it instead' : 'Delete'}
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

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === 'checkbox') {
    return (
      <label className={styles.checkField}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
    )
  }
  return (
    <label className={styles.field}>
      <span>{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : field.type === 'select' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}
