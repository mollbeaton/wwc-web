import type { Role } from '../api/types'

// Who may do what on the Stock pages. The API enforces all of this; these only
// decide which buttons to show.

/** Sales, returns, transfers, breakage, stock takes and keg returns. */
export function canSell(role: Role | null): boolean {
  return role === 'seller' || role === 'admin'
}

/** Registering kegs (and sending them back to the lessor) is cellar work. */
export function canManageKegs(role: Role | null): boolean {
  return role === 'cellar' || role === 'admin'
}

/** Where a role lands after sign-in, and where a guard bounces it to. Sellers
 *  never see Tanks, so they start on Stock. */
export function homePath(role: Role | null): string {
  return role === 'seller' ? '/stock' : '/tanks'
}
