import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { kegsApi, type Keg, type KegStatus } from '../../api/kegs'
import { useAuth } from '../../auth/AuthContext'
import { canManageKegs, canSell } from '../../auth/roles'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Modal, ModalActions } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import { cap, shortDate } from '../../lib/format'
import { dateTime, errorText, nowIso } from '../../lib/stock'
import styles from '../stock/Stock.module.css'

/** A keg out longer than this is chased. */
const OVERDUE_DAYS = 30

const GRID = 'minmax(140px, 1.2fr) 60px 120px minmax(140px, 1.3fr) minmax(120px, 1fr) 70px minmax(150px, 1fr)'

const STATUS: Record<KegStatus, { label: string; cls: string }> = {
  empty: { label: 'Empty', cls: 'pill--grey' },
  filled: { label: 'Filled', cls: 'pill--blue' },
  with_customer: { label: 'With customer', cls: 'pill--amber' },
  off_hired: { label: 'Off-hired', cls: 'pill--dashed' },
}

type Filter = 'all' | KegStatus
type Action = { keg: Keg; kind: 'return' | 'off-hire' }

/** Leased kegs: where each one is, who has it and for how long. */
export function KegsPage() {
  const { effectiveRole } = useAuth()
  const queryClient = useQueryClient()
  const kegs = useQuery({ queryKey: ['kegs'], queryFn: kegsApi.list })
  const [filter, setFilter] = useState<Filter>('all')
  const [registering, setRegistering] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const [historyFor, setHistoryFor] = useState<Keg | null>(null)

  const all = kegs.data ?? []
  const rows = filter === 'all' ? all : all.filter((k) => k.status === filter)
  const overdue = all.filter((k) => (k.days_out ?? 0) > OVERDUE_DAYS).length

  const act = useMutation({
    mutationFn: (a: Action) =>
      a.kind === 'return' ? kegsApi.markReturned(a.keg.id, nowIso()) : kegsApi.offHire(a.keg.id, nowIso()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['kegs'] })
      setAction(null)
    },
  })

  return (
    <div>
      <PageHeader
        title="Kegs"
        subtitle={`Leased kegs: where they are and who has them${overdue ? ` · ${overdue} out over ${OVERDUE_DAYS} days` : ''}`}
        actions={
          canManageKegs(effectiveRole) && (
            <button className="btn btn--primary" onClick={() => setRegistering(true)}>
              <IconPlus size={16} stroke={2} /> Register keg
            </button>
          )
        }
      />

      <div className={styles.toolbar}>
        <Segmented
          label="Status"
          options={[{ value: 'all', label: 'All' }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </div>

      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Kegs">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: GRID }} role="row">
            <span role="columnheader">Keg</span>
            <span role="columnheader" className={styles.num}>Size</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Contents</span>
            <span role="columnheader">Holder</span>
            <span role="columnheader" className={styles.num}>Days out</span>
            <span role="columnheader" />
          </div>
          {rows.map((k) => {
            const isOverdue = (k.days_out ?? 0) > OVERDUE_DAYS
            return (
              <div key={k.id} className={styles.row} style={{ gridTemplateColumns: GRID }} role="row">
                <span role="cell" className={styles.cell}>
                  <span className={`mono ${styles.strong}`}>{k.lessor_keg_id}</span>
                  <span className={styles.sub}>{k.lessor}</span>
                </span>
                <span role="cell" className={`mono ${styles.num}`}>{Number(k.size_l)}&nbsp;L</span>
                <span role="cell">
                  <span className={`pill ${STATUS[k.status].cls}`}>{STATUS[k.status].label}</span>
                </span>
                <span role="cell" className={styles.cell}>
                  {k.lot_id ? (
                    <>
                      <Link to={`/lots/${k.lot_id}`} className="mono text-link">
                        {k.lot_code}
                      </Link>
                      <span className={styles.sub}>{k.product_name}</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
                <span role="cell" className={styles.cell}>
                  {k.customer_name ?? <span className="muted">—</span>}
                  {k.last_moved_at && <span className={styles.sub}>since {shortDate(k.last_moved_at)}</span>}
                </span>
                <span role="cell" className={`mono ${styles.num} ${isOverdue ? styles.overdue : ''}`}>
                  {k.days_out ?? '—'}
                </span>
                <span role="cell" className={styles.cellActions}>
                  {k.status === 'with_customer' && canSell(effectiveRole) && (
                    <button type="button" className="text-link" onClick={() => setAction({ keg: k, kind: 'return' })}>
                      Return
                    </button>
                  )}
                  {k.status === 'empty' && canManageKegs(effectiveRole) && (
                    <button type="button" className="text-link" onClick={() => setAction({ keg: k, kind: 'off-hire' })}>
                      Off-hire
                    </button>
                  )}
                  <button type="button" className="text-link" onClick={() => setHistoryFor(k)}>
                    History
                  </button>
                </span>
              </div>
            )
          })}
          {kegs.isPending && <p className={styles.empty}>Loading…</p>}
          {kegs.isError && <p className={styles.empty}>{errorText(kegs.error, 'Couldn’t load kegs.')}</p>}
          {kegs.data && rows.length === 0 && (
            <p className={styles.empty}>{all.length === 0 ? 'No kegs registered yet.' : 'None with this status.'}</p>
          )}
        </div>
      </div>

      {registering && <RegisterKegModal onClose={() => setRegistering(false)} />}
      {historyFor && <KegHistoryModal keg={historyFor} onClose={() => setHistoryFor(null)} />}
      {action && (
        <ConfirmDialog
          title={
            action.kind === 'return'
              ? `Keg ${action.keg.lessor_keg_id} back empty?`
              : `Off-hire keg ${action.keg.lessor_keg_id}?`
          }
          confirmLabel={action.kind === 'return' ? 'Mark returned' : 'Off-hire'}
          pending={act.isPending}
          error={act.error ? errorText(act.error, 'Could not update the keg') : null}
          onConfirm={() => act.mutate(action)}
          onCancel={() => {
            act.reset()
            setAction(null)
          }}
        >
          <p>
            {action.kind === 'return'
              ? `The empty keg is back from ${action.keg.customer_name ?? 'the customer'}.`
              : `It goes back to ${action.keg.lessor} and drops off the list of kegs in use.`}
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}

function RegisterKegModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [lessor, setLessor] = useState('')
  const [lessorKegId, setLessorKegId] = useState('')
  const [size, setSize] = useState('30')
  const [error, setError] = useState<string | null>(null)
  const [id] = useState(() => crypto.randomUUID())

  const save = useMutation({
    mutationFn: () => kegsApi.create({ id, lessor: lessor.trim(), lessor_keg_id: lessorKegId.trim(), size_l: size }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['kegs'] })
      onClose()
    },
    onError: (e) => setError(errorText(e, 'Could not register the keg')),
  })
  const valid = lessor.trim() !== '' && lessorKegId.trim() !== '' && Number(size) > 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <Modal title="Register keg" onClose={onClose} dismissable={!save.isPending} as="form" onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Lessor</span>
        <input value={lessor} onChange={(e) => setLessor(e.target.value)} autoFocus />
      </label>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Lessor’s keg ID</span>
          <input value={lessorKegId} onChange={(e) => setLessorKegId(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Size (L)</span>
          <input type="number" min="1" step="0.5" value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
      </div>
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
          {save.isPending ? 'Saving…' : 'Register keg'}
        </button>
      </ModalActions>
    </Modal>
  )
}

function KegHistoryModal({ keg, onClose }: { keg: Keg; onClose: () => void }) {
  const events = useQuery({ queryKey: ['kegs', keg.id, 'events'], queryFn: () => kegsApi.events(keg.id) })
  return (
    <Modal title={`Keg ${keg.lessor_keg_id}`} onClose={onClose} width={560}>
      <p className={styles.hint}>
        {keg.lessor} · {Number(keg.size_l)} L
      </p>
      {events.isPending && <p className="muted">Loading…</p>}
      {events.isError && <p className={styles.error}>{errorText(events.error, 'Couldn’t load the history.')}</p>}
      {events.data?.length === 0 && <p className="muted">No events yet.</p>}
      <div>
        {events.data?.map((e) => (
          <div key={e.id} className={styles.miniRow} style={{ gridTemplateColumns: '110px 1fr 1fr' }}>
            <span className="muted">{dateTime(e.occurred_at)}</span>
            <span>{cap(e.type.replace(/_/g, ' '))}</span>
            <span className={styles.sub}>
              {[e.lot_code, e.customer_name, e.sale_reference].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        ))}
      </div>
      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </ModalActions>
    </Modal>
  )
}
