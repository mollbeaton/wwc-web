import { PageHeader } from '../components/PageHeader'

/** Temporary stand-in for a screen not yet built out. Every route resolves so
 *  the shell, nav and role gating are all exercisable now; each phase replaces
 *  these with the real page. */
export function Placeholder({
  title,
  subtitle,
  spec,
}: {
  title: string
  subtitle?: string
  spec: string
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card muted">
        Coming soon — {spec}.
      </div>
    </div>
  )
}
