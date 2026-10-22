import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconRefresh } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import {
  isStubbed,
  xeroApi,
  type FakeXeroDocType,
  type XeroAccounts,
  type XeroJob,
  type XeroJobStatus,
  type XeroStatus,
} from '../../api/xero'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/Segmented'
import { Tabs } from '../../components/Tabs'
import { cap, gbp, shortDate } from '../../lib/format'
import { dateTime, errorText, signed } from '../../lib/stock'
import styles from '../stock/Stock.module.css'
import { invalidateXero } from './invalidateXero'
import { XeroDemoControls } from './XeroDemoControls'

/** Polled this often so a demo shows jobs moving queued → sent on their own. */
export const XERO_POLL_MS = 3000

const JOB_GRID = 'minmax(180px, 1.6fr) 110px 120px 70px minmax(150px, 1.4fr) 130px'
const DRIFT_GRID = 'minmax(180px, 1.6fr) 80px 80px 80px 140px'
const ITEM_GRID = '100px minmax(160px, 1.6fr) 80px 110px 110px'

const JOB_STATUS: Record<XeroJobStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'pill--grey' },
  done: { label: 'Done', cls: 'pill--green' },
  failed: { label: 'Failed', cls: 'pill--coral' },
  needs_attention: { label: 'Needs attention', cls: 'pill--amber' },
  cancelled: { label: 'Cancelled', cls: 'pill--dashed' },
}

const DOC_TYPE: Record<FakeXeroDocType, string> = {
  ACCREC: 'Invoice',
  ACCPAY: 'Bill',
  ACCRECCREDIT: 'Credit note',
  ACCPAYCREDIT: 'Supplier credit',
}

const ACCOUNT_FIELDS: { key: keyof XeroAccounts; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'cogs', label: 'Cost of goods sold' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'production_clearing', label: 'Production clearing' },
  { key: 'write_off', label: 'Write-off' },
  { key: 'opening_clearing', label: 'Opening balance clearing' },
]

/** Admin's view of the Xero sync: the connection and its settings, the job
 *  queue, stock drift, and (against the stubbed Xero) what "Xero" holds plus
 *  controls to break things for a demo. */
export function XeroPage() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ['xero', 'status'], queryFn: xeroApi.status, refetchInterval: XERO_POLL_MS })
  const [processed, setProcessed] = useState<number | null>(null)

  const syncNow = useMutation({
    mutationFn: xeroApi.syncNow,
    onMutate: () => setProcessed(null),
    onSuccess: async (r) => {
      setProcessed(r.processed)
      await invalidateXero(queryClient)
    },
  })

  return (
    <div>
      <PageHeader
        title="Xero"
        subtitle="What’s been sent to Xero, what’s waiting, and whether stock agrees"
        actions={
          <>
            {processed != null && <span className="muted">{processed} processed</span>}
            <button className="btn btn--primary" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
              <IconRefresh size={16} stroke={2} /> {syncNow.isPending ? 'Syncing…' : 'Sync now'}
            </button>
          </>
        }
      />
      {syncNow.error && <p className={styles.error}>{errorText(syncNow.error, 'Sync failed')}</p>}

      {status.isPending && <div className={`skeleton ${styles.tableSkeleton}`} aria-busy="true" />}
      {status.isError && (
        <p className={styles.error}>
          {errorText(status.error, 'Couldn’t load the Xero status.')}{' '}
          <button type="button" className="text-link" onClick={() => status.refetch()}>
            Retry
          </button>
        </p>
      )}

      {status.data && (
        <>
          <div className={styles.grid2}>
            <ConnectionCard status={status.data} />
            <SettingsCard status={status.data} />
          </div>
          <JobsSection />
          <DriftSection />
          {isStubbed(status.data) && (
            <>
              <XeroHoldsSection />
              <XeroDemoControls />
            </>
          )}
        </>
      )}
    </div>
  )
}

function ConnectionCard({ status }: { status: XeroStatus }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => (status.connected ? xeroApi.disconnect() : xeroApi.connect()),
    onSuccess: () => invalidateXero(queryClient),
  })
  const { pending, failed, needs_attention } = status.counts

  return (
    <div className="card">
      <div className={styles.sectionHead} style={{ marginBottom: 10 }}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>
          Connection
        </h2>
        <span className={`pill ${isStubbed(status) ? 'pill--blue' : 'pill--grey'}`}>
          {isStubbed(status) ? 'Stubbed Xero' : cap(status.mode)}
        </span>
      </div>
      <p style={{ margin: '0 0 6px' }}>
        <span className={`pill ${status.connected ? 'pill--green' : 'pill--grey'}`}>
          {status.connected ? 'Connected' : 'Not connected'}
        </span>{' '}
        {status.tenant_name && <span className={styles.strong}>{status.tenant_name}</span>}
      </p>
      <p className={styles.hint}>
        Worker {status.worker_enabled ? 'running' : 'off'}
        {status.last_run_at && ` · last run ${dateTime(status.last_run_at)}`}
      </p>
      <p className={styles.hint} style={{ marginTop: 4 }}>
        {pending} pending · {failed} failed · {needs_attention} need attention
      </p>
      {toggle.error && <p className={styles.error}>{errorText(toggle.error, 'Could not change the connection')}</p>}
      <div style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
          {status.connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

function SettingsCard({ status }: { status: XeroStatus }) {
  const queryClient = useQueryClient()
  // Seeded once from the first load; the status keeps polling underneath, and
  // re-seeding would wipe what's being typed.
  const [invoiceStatus, setInvoiceStatus] = useState(status.invoice_status)
  const [accounts, setAccounts] = useState<XeroAccounts>(status.accounts)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: () => xeroApi.saveSettings({ invoice_status: invoiceStatus, accounts }),
    onMutate: () => setSaved(false),
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['xero', 'status'] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit} aria-label="Xero settings">
      <h2 className={styles.cardTitle} style={{ margin: 0 }}>
        Settings
      </h2>
      <label className={styles.field}>
        <span>New invoices are</span>
        <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
          <option value="AUTHORISED">Authorised (approved)</option>
          <option value="DRAFT">Draft (approve in Xero)</option>
        </select>
      </label>
      <div className={styles.fieldRow}>
        {ACCOUNT_FIELDS.map((f) => (
          <label key={f.key} className={styles.field}>
            <span>{f.label}</span>
            <input
              className="mono"
              value={accounts[f.key] ?? ''}
              onChange={(e) => setAccounts({ ...accounts, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {save.error && <p className={styles.error}>{errorText(save.error, 'Could not save the settings')}</p>}
      <div className={styles.chips} style={{ alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="muted">Saved</span>}
      </div>
    </form>
  )
}

type JobFilter = 'all' | XeroJobStatus

function JobsSection() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<JobFilter>('all')
  const jobs = useQuery({
    queryKey: ['xero', 'jobs', filter],
    queryFn: () => xeroApi.jobs(filter === 'all' ? undefined : filter),
    refetchInterval: XERO_POLL_MS,
  })
  const act = useMutation({
    mutationFn: ({ job, kind }: { job: XeroJob; kind: 'retry' | 'cancel' }) =>
      kind === 'retry' ? xeroApi.retryJob(job.id) : xeroApi.cancelJob(job.id),
    onSuccess: () => invalidateXero(queryClient),
  })
  const rows = jobs.data ?? []

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          Job queue <span className={styles.count}>{rows.length}</span>
        </h2>
        <Segmented
          label="Status"
          options={[
            { value: 'all', label: 'All' },
            ...Object.entries(JOB_STATUS).map(([value, s]) => ({ value, label: s.label })),
          ]}
          value={filter}
          onChange={(v) => setFilter(v as JobFilter)}
        />
      </div>
      {act.error && <p className={styles.error}>{errorText(act.error, 'Could not update the job')}</p>}
      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Job queue">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: JOB_GRID }} role="row">
            <span role="columnheader">Job</span>
            <span role="columnheader">Kind</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className={styles.num}>Tries</span>
            <span role="columnheader">Last error</span>
            <span role="columnheader" />
          </div>
          {rows.map((j) => {
            const canRetry = j.status === 'failed' || j.status === 'needs_attention' || j.status === 'cancelled'
            const canCancel = j.status === 'pending' || j.status === 'failed' || j.status === 'needs_attention'
            return (
              <div key={j.id} className={styles.row} style={{ gridTemplateColumns: JOB_GRID }} role="row">
                <span role="cell" className={styles.cell}>
                  {j.label}
                  <span className={styles.sub}>
                    {dateTime(j.created_at)}
                    {j.xero_id && ` · ${j.xero_id}`}
                  </span>
                </span>
                <span role="cell" className={styles.sub}>{cap(j.kind.replace(/_/g, ' '))}</span>
                <span role="cell" className={styles.cell}>
                  <span className={`pill ${JOB_STATUS[j.status].cls}`} style={{ alignSelf: 'flex-start' }}>
                    {JOB_STATUS[j.status].label}
                  </span>
                  {j.status === 'failed' && j.next_attempt_at && (
                    <span className={styles.sub}>next {dateTime(j.next_attempt_at)}</span>
                  )}
                </span>
                <span role="cell" className={`mono ${styles.num}`}>{j.attempts}</span>
                <span role="cell" className={styles.sub} title={j.last_error ?? undefined}>
                  {j.last_error ?? '—'}
                </span>
                <span role="cell" className={styles.cellActions}>
                  {canRetry && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ job: j, kind: 'retry' })}
                    >
                      Retry
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ job: j, kind: 'cancel' })}
                    >
                      Cancel
                    </button>
                  )}
                </span>
              </div>
            )
          })}
          {jobs.isPending && <p className={styles.empty}>Loading…</p>}
          {jobs.isError && <p className={styles.empty}>{errorText(jobs.error, 'Couldn’t load jobs.')}</p>}
          {jobs.data && rows.length === 0 && <p className={styles.empty}>No jobs.</p>}
        </div>
      </div>
    </section>
  )
}

function DriftSection() {
  const queryClient = useQueryClient()
  const drift = useQuery({ queryKey: ['xero', 'drift'], queryFn: xeroApi.drift, refetchInterval: XERO_POLL_MS })
  const correct = useMutation({
    mutationFn: (productId: string) => xeroApi.correctDrift(productId),
    onSuccess: () => invalidateXero(queryClient),
  })
  const rows = drift.data ?? []

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            Stock drift <span className={styles.count}>{rows.length}</span>
          </h2>
          <p className={styles.note}>Products where Xero’s quantity differs from ours. A correction makes Xero match.</p>
        </div>
      </div>
      {correct.error && <p className={styles.error}>{errorText(correct.error, 'Could not queue the correction')}</p>}
      <div className="card card--flush">
        <div className={styles.scroll} role="table" aria-label="Stock drift">
          <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: DRIFT_GRID }} role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader" className={styles.num}>WWC</span>
            <span role="columnheader" className={styles.num}>Xero</span>
            <span role="columnheader" className={styles.num}>Delta</span>
            <span role="columnheader" />
          </div>
          {rows.map((d) => (
            <div key={d.product_id} className={styles.row} style={{ gridTemplateColumns: DRIFT_GRID }} role="row">
              <span role="cell" className={styles.cell}>
                <span className="mono">{d.code}</span>
                <span className={styles.sub}>{d.name}</span>
              </span>
              <span role="cell" className={`mono ${styles.num}`}>{d.wwc_qty}</span>
              <span role="cell" className={`mono ${styles.num}`}>{d.xero_qty}</span>
              <span role="cell" className={`mono ${styles.num} ${styles.negative}`}>{signed(d.delta)}</span>
              <span role="cell" className={styles.cellActions}>
                {d.state === 'pending' ? (
                  <span className="pill pill--grey">Correction queued</span>
                ) : (
                  <button
                    type="button"
                    className="text-link"
                    disabled={correct.isPending}
                    onClick={() => correct.mutate(d.product_id)}
                  >
                    Push correction
                  </button>
                )}
              </span>
            </div>
          ))}
          {drift.isPending && <p className={styles.empty}>Loading…</p>}
          {drift.data && rows.length === 0 && <p className={styles.empty}>No drift - Xero agrees with our stock.</p>}
        </div>
      </div>
    </section>
  )
}

type HoldsTab = 'items' | 'documents'

/** The stubbed Xero's own records, so the demo can show what landed there. */
function XeroHoldsSection() {
  const [tab, setTab] = useState<HoldsTab>('items')
  const items = useQuery({ queryKey: ['xero', 'fake', 'items'], queryFn: xeroApi.fakeItems, refetchInterval: XERO_POLL_MS })
  const docs = useQuery({
    queryKey: ['xero', 'fake', 'documents'],
    queryFn: xeroApi.fakeDocuments,
    refetchInterval: XERO_POLL_MS,
  })

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>What Xero holds</h2>
          <p className={styles.note}>Read straight from the stubbed Xero.</p>
        </div>
      </div>
      <Tabs
        tabs={[
          { value: 'items', label: `Items (${items.data?.length ?? 0})` },
          { value: 'documents', label: `Documents (${docs.data?.length ?? 0})` },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'items' && (
        <div className="card card--flush">
          <div className={styles.scroll} role="table" aria-label="Xero items">
            <div className={`${styles.row} ${styles.head}`} style={{ gridTemplateColumns: ITEM_GRID }} role="row">
              <span role="columnheader">Code</span>
              <span role="columnheader">Name</span>
              <span role="columnheader" className={styles.num}>Qty</span>
              <span role="columnheader" className={styles.num}>Cost pool</span>
              <span role="columnheader" className={styles.num}>Avg cost</span>
            </div>
            {(items.data ?? []).map((i) => (
              <div key={i.code} className={styles.row} style={{ gridTemplateColumns: ITEM_GRID }} role="row">
                <span role="cell" className="mono">{i.code}</span>
                <span role="cell">{i.name}</span>
                <span role="cell" className={`mono ${styles.num}`}>{i.quantity_on_hand}</span>
                <span role="cell" className={`mono ${styles.num}`}>{gbp(i.total_cost_pool)}</span>
                <span role="cell" className={`mono ${styles.num}`}>{gbp(i.average_cost)}</span>
              </div>
            ))}
            {items.data?.length === 0 && <p className={styles.empty}>No items in Xero yet.</p>}
          </div>
        </div>
      )}
      {tab === 'documents' && (
        <div className="card-stack">
          {docs.data?.length === 0 && <div className="card muted">No documents in Xero yet.</div>}
          {(docs.data ?? []).map((d) => (
            <div key={d.id} className="card">
              <div className={styles.sectionHead} style={{ marginBottom: 8, alignItems: 'center' }}>
                <div className={styles.cell}>
                  <span>
                    <span className={styles.strong}>{DOC_TYPE[d.type]}</span>{' '}
                    <span className="mono">{d.number ?? '(no number)'}</span>
                  </span>
                  <span className={styles.sub}>
                    {[d.contact_name, d.reference, shortDate(d.date)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className={styles.chips} style={{ alignItems: 'center' }}>
                  {!d.created_by_app && <span className="pill pill--amber">Raised in Xero</span>}
                  <span className="pill pill--grey">{cap(d.status.toLowerCase())}</span>
                  <span className={`mono ${styles.strong}`}>{gbp(d.total)}</span>
                </div>
              </div>
              {d.lines.map((l, i) => (
                <div key={i} className={styles.miniRow} style={{ gridTemplateColumns: '90px 1fr 50px 80px 70px 80px' }}>
                  <span className="mono">{l.item_code ?? '—'}</span>
                  <span className={styles.sub}>{l.description}</span>
                  <span className={`mono ${styles.num}`}>{l.quantity}</span>
                  <span className={`mono ${styles.num}`}>{gbp(l.unit_amount)}</span>
                  <span className={`mono ${styles.sub}`}>{l.account_code ?? ''}</span>
                  <span className={`mono ${styles.num} ${styles.sub}`}>{l.cogs ? `COGS ${gbp(l.cogs)}` : ''}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
