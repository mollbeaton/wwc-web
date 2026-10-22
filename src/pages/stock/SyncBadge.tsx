import type { XeroSync } from '../../api/catalog'
import type { SyncState } from '../../api/stock'
import { signed } from '../../lib/stock'

/** Whether a product's stock agrees with Xero. Drift reads as Xero minus WWC,
 *  so "+2" means Xero thinks there are two more than there are. */
export function SyncBadge({ state, drift }: { state: SyncState; drift: number }) {
  if (state === 'in_sync') return <span className="pill pill--green">In sync</span>
  if (state === 'pending') return <span className="pill pill--grey">Pending</span>
  return <span className="pill pill--coral">Drift {signed(drift)}</span>
}

/** Whether a product or customer has reached Xero yet. */
export function XeroSyncPill({ sync }: { sync: XeroSync }) {
  if (sync === 'synced') return <span className="pill pill--green">In Xero</span>
  if (sync === 'pending') return <span className="pill pill--grey">Pending</span>
  return <span className="pill pill--coral">Failed</span>
}
