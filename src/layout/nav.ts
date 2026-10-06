import {
  IconAdjustments,
  IconBottle,
  IconBuildingWarehouse,
  IconCurrencyPound,
  IconDroplet,
  IconFlask,
  IconGrave2,
  IconMapPin,
  IconPackageExport,
  IconPlant2,
  IconTruck,
  IconUsers,
  type Icon,
} from '@tabler/icons-react'
import type { Role } from '../api/types'

export interface NavItem {
  to: string
  label: string
  icon: Icon
  /** Roles allowed to see this item. */
  roles: Role[]
  /** Other path prefixes that belong to this section, so it stays highlighted
   *  on pages that aren't its own route (e.g. a lot page is part of Trace). */
  alsoActiveFor?: string[]
}

const ALL: Role[] = ['admin', 'cellar', 'viewer']

// Main nav. Role visibility per the handoff: Cellar sees Tanks + Trace (and
// Ready for sale - finished stock, no money); Viewer
// adds Duty (read-only); Admin sees everything including Manage.
export const MAIN_NAV: NavItem[] = [
  { to: '/tanks', label: 'Tanks', icon: IconBuildingWarehouse, roles: ALL },
  // Lot and harvest pages are trace views (history, backward and forward
  // trace), whichever list you opened them from.
  { to: '/trace', label: 'Trace', icon: IconDroplet, roles: ALL, alsoActiveFor: ['/lots/', '/harvests/'] },
  { to: '/ready-for-sale', label: 'Ready for sale', icon: IconPackageExport, roles: ALL },
  { to: '/duty', label: 'Duty', icon: IconCurrencyPound, roles: ['admin', 'viewer'] },
  { to: '/duty-settings', label: 'Duty settings', icon: IconAdjustments, roles: ['admin'] },
]

// Everything under Manage is admin only (WD-29 to WD-38).
export const MANAGE_NAV: NavItem[] = [
  { to: '/manage/users', label: 'Users', icon: IconUsers, roles: ['admin'] },
  { to: '/manage/orchards', label: 'Orchards', icon: IconMapPin, roles: ['admin'] },
  { to: '/manage/varieties', label: 'Varieties', icon: IconPlant2, roles: ['admin'] },
  { to: '/manage/additives', label: 'Additives', icon: IconFlask, roles: ['admin'] },
  { to: '/manage/suppliers', label: 'Suppliers & canners', icon: IconTruck, roles: ['admin'] },
  { to: '/manage/packaging', label: 'Packaging', icon: IconBottle, roles: ['admin'] },
  { to: '/manage/loss-reasons', label: 'Loss reasons', icon: IconGrave2, roles: ['admin'] },
  { to: '/manage/vessels', label: 'Vessels', icon: IconBuildingWarehouse, roles: ['admin'] },
]

export function visibleFor(items: NavItem[], role: Role | null): NavItem[] {
  if (!role) return []
  return items.filter((item) => item.roles.includes(role))
}
