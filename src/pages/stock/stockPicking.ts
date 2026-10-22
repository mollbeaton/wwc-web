import type { StockLot, StockRow } from '../../api/stock'

// Picking stock from the GET /stock rows: which lots of a product sit at a
// location, and how many units are available there.

export function lotsAt(row: StockRow | undefined, locationId: string): StockLot[] {
  return (row?.lots ?? []).filter((l) => l.location_id === locationId && l.qty > 0)
}

/** Units available at a location - of one lot when `lotId` is set, else of
 *  the product. */
export function availableAt(row: StockRow | undefined, locationId: string, lotId = ''): number {
  if (!row || !locationId) return 0
  if (lotId) return lotsAt(row, locationId).find((l) => l.lot_id === lotId)?.qty ?? 0
  return row.by_location.find((l) => l.location_id === locationId)?.qty ?? 0
}

/** The locations holding some of a product. */
export function locationsHolding(row: StockRow | undefined) {
  return (row?.by_location ?? []).filter((l) => l.qty > 0)
}
