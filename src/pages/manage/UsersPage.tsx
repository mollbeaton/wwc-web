import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { usersApi, type User, type UserCreateInput } from '../../api/management'
import { ChangeLog } from '../../components/ChangeLog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageHeader } from '../../components/PageHeader'
import { ListState } from './ListState'
import styles from './Management.module.css'

const ROLES: { value: string; label: string; blurb: string }[] = [
  { value: 'admin', label: 'Admin', blurb: 'Everything, including management, duty filing and corrections.' },
  { value: 'cellar', label: 'Cellar', blurb: 'Captures production on iOS; sees Tanks and Trace.' },
  { value: 'viewer', label: 'Viewer', blurb: 'Read-only: Tanks, Trace and Duty. No changes.' },
]

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role
}

function lastSignIn(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const list = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })
  const users = list.data ?? []
  const selected = users.find((u) => u.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const visible = users.filter((u) =>
    q === '' || [u.name, u.email, roleLabel(u.role)].some((s) => (s ?? '').toLowerCase().includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Who can sign in, and what they can do"
        actions={
          <button
            className="btn btn--primary"
            onClick={() => {
              setCreating(true)
              setSelectedId(null)
            }}
          >
            <IconPlus size={16} stroke={2} /> Add user
          </button>
        }
      />

      <div className={styles.roleCards}>
        {ROLES.map((r) => (
          <div key={r.value} className={styles.roleCard}>
            <div className={styles.roleName}>{r.label}</div>
            <div className={styles.roleBlurb}>{r.blurb}</div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <IconSearch size={16} stroke={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users"
            aria-label="Search users"
          />
        </div>
      </div>

      <div className={styles.layout}>
        <div className={`card ${styles.tableCard}`}>
          <div className={`${styles.row} ${styles.userRow} ${styles.head}`}>
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Last sign-in</span>
            <span>Status</span>
          </div>
          {visible.map((u) => (
            <button
              key={u.id}
              className={`${styles.row} ${styles.userRow} ${styles.rowButton} ${u.id === selectedId ? styles.selected : ''}`}
              onClick={() => {
                setSelectedId(u.id)
                setCreating(false)
              }}
            >
              <span className={styles.name}>{u.name ?? '—'}</span>
              <span className={styles.muted}>{u.email}</span>
              <span>{roleLabel(u.role)}</span>
              <span className={styles.muted}>{lastSignIn(u.last_sign_in_at)}</span>
              <span className={`pill ${u.status === 'active' ? 'pill--green' : 'pill--grey'}`}>
                {u.status === 'active' ? 'Active' : 'Deactivated'}
              </span>
            </button>
          ))}
          <ListState
            isPending={list.isPending}
            isError={list.isError}
            isEmpty={visible.length === 0}
            emptyLabel={users.length === 0 ? 'No users.' : 'No matches.'}
            onRetry={() => list.refetch()}
          />
        </div>

        {(creating || selected) && (
          <UserDetail
            key={selected?.id ?? 'new'}
            user={creating ? null : selected}
            onDone={() => {
              setCreating(false)
              invalidate()
            }}
          />
        )}
      </div>
    </div>
  )
}

function UserDetail({ user, onDone }: { user: User | null; onDone: () => void }) {
  const [form, setForm] = useState<UserCreateInput>(
    user
      ? { email: user.email, name: user.name ?? '', role: user.role, password: '' }
      : { email: '', name: '', role: 'cellar', password: '' },
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)

  const changeLog = useQuery({
    queryKey: ['users', user?.id, 'change-log'],
    queryFn: () => usersApi.changeLog(user!.id),
    enabled: !!user,
  })

  const save = useMutation({
    mutationFn: () =>
      user ? usersApi.update(user.id, { name: form.name, role: form.role }) : usersApi.create(form),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const status = useMutation({
    mutationFn: () => (user!.status === 'active' ? usersApi.deactivate(user!.id) : usersApi.reactivate(user!.id)),
    onSuccess: () => {
      setConfirmingDeactivate(false)
      onDone()
    },
    onError: (e) => {
      // While the confirm dialog is up it shows the error itself.
      if (!confirmingDeactivate) setError(e instanceof ApiError ? e.message : 'Could not change status')
    },
  })

  const dirty = !user || form.name !== (user.name ?? '') || form.role !== user.role
  const valid = user
    ? true
    : /.+@.+\..+/.test(form.email) && form.password.length >= 8 && form.role.length > 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className={`card ${styles.panel}`}>
      <h3 className={styles.panelTitle}>{user ? (user.name ?? user.email) : 'New user'}</h3>

      <form onSubmit={onSubmit} className={styles.form}>
        {!user && (
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
        )}
        <label className={styles.field}>
          <span>Name</span>
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Role</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {!user && (
          <label className={styles.field}>
            <span>Initial password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? 'Saving…' : user ? 'Save' : 'Create user'}
        </button>
      </form>

      {user && (
        <>
          <div className={styles.actions}>
            <button
              className="btn"
              onClick={() => {
                // Deactivating signs someone out of the iOS app mid-shift, so
                // confirm it; reactivating is harmless and stays one click.
                if (user.status === 'active') {
                  status.reset()
                  setConfirmingDeactivate(true)
                } else {
                  status.mutate()
                }
              }}
              disabled={status.isPending}
            >
              {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
          <div className={styles.logSection}>
            <h4 className={styles.logTitle}>Change log</h4>
            <ChangeLog entries={changeLog.data ?? []} />
          </div>
        </>
      )}

      {confirmingDeactivate && user && (
        <ConfirmDialog
          title={`Deactivate ${user.name ?? user.email}?`}
          confirmLabel="Deactivate"
          pendingLabel="Deactivating…"
          tone="danger"
          pending={status.isPending}
          error={
            status.error
              ? status.error instanceof ApiError
                ? status.error.message
                : 'Could not deactivate'
              : null
          }
          onConfirm={() => status.mutate()}
          onCancel={() => setConfirmingDeactivate(false)}
        >
          <p>
            They’ll be signed out and won’t be able to sign in to the dashboard or the cellar app.
            Their past entries stay. You can reactivate them at any time.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}
