export interface LotStatusFields {
  status: string
  kind: string
  ready_for_sale_volume_l: string
}

/** The status pill shown for a lot (WD-12), shared by the lot page, trace index
 *  and forward trace so they agree. */
export function lotStatusPill(lot: LotStatusFields): { label: string; cls: string } {
  if (lot.status === 'ended') return { label: 'Ended', cls: 'pill--grey' }
  if (lot.status === 'archived') return { label: 'Archived', cls: 'pill--grey' }
  const released = lot.status === 'dispatched' || Number(lot.ready_for_sale_volume_l) > 0
  if (released) return { label: 'Ready for sale', cls: 'pill--green' }
  if (lot.kind !== 'tank') return { label: 'Packaged', cls: 'pill--dashed' }
  return { label: 'In vessel', cls: 'pill--blue' }
}

export interface ReleaseFields {
  kind: string
  status: string
  current_volume_l: string
  ready_for_sale_volume_l: string
}

/** Marked ready for sale - released, duty point passed. Also true of tank lots
 *  released by the old bulk dispatch, so they still show up as released. */
export function isReady(lot: ReleaseFields): boolean {
  return Number(lot.ready_for_sale_volume_l) > 0
}

/** Bottled or boxed, still here, not yet marked ready. (A canned lot never
 *  waits: sending it to the canner marks it ready.) Packaged lots stay
 *  "active" - "packaged" is the status of the tank lot they came from. */
export function isAwaitingRelease(lot: ReleaseFields): boolean {
  return (
    lot.kind !== 'tank' &&
    lot.status === 'active' &&
    !isReady(lot) &&
    Number(lot.current_volume_l) > 0
  )
}
