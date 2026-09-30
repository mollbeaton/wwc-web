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
