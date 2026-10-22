import { api } from './client'
import type { ProductKind } from './catalog'

// Finished stock: units of a product, by lot and location. Quantities are
// whole units (integers); a movement's qty is signed.

export interface StockByLocation {
  location_id: string
  location_name: string
  qty: number
}

export interface StockLot {
  lot_id: string
  lot_code: string
  released_at: string | null
  location_id: string
  location_name: string
  qty: number
}

export type SyncState = 'in_sync' | 'pending' | 'drift'

export interface StockRow {
  product_id: string
  code: string
  name: string
  kind: ProductKind
  unit_volume_l: string
  on_hand: number
  by_location: StockByLocation[]
  lots: StockLot[]
  /** Null when Xero isn't connected. */
  xero_qty: number | null
  sync_state: SyncState
  /** xero_qty - on_hand while drifting, else 0. */
  drift: number
}

export type MovementType =
  | 'released'
  | 'sold'
  | 'returned'
  | 'broken'
  | 'transfer_out'
  | 'transfer_in'
  | 'count_adjustment'
  | 'opening'

export interface StockMovement {
  id: string
  type: MovementType
  product_id: string
  product_code: string
  lot_id: string | null
  lot_code: string | null
  location_id: string
  location_name: string
  qty: number
  occurred_at: string
  note: string | null
  sale_id: string | null
  sale_reference: string | null
  recorded_by_email: string | null
}

export interface AwaitingRelease {
  lot_id: string
  lot_code: string
  name: string | null
  kind: string
  unit_volume_l: string | null
  unit_count: number | null
  product_id: string | null
  product_type: 'cider' | 'wine' | null
}

export interface CannerAwaiting {
  lot_id: string
  lot_code: string
  name: string | null
  volume_l: string
  canner: string | null
  sent_at: string
}

export interface CannerReceiptInput {
  id: string
  lot_id: string
  product_id: string
  unit_count: number
  occurred_at: string
}

export interface TransferInput {
  id: string
  product_id: string
  lot_id?: string
  from_location_id: string
  to_location_id: string
  qty: number
  occurred_at: string
}

export interface BreakageInput {
  id: string
  product_id: string
  lot_id?: string
  location_id: string
  qty: number
  reason: string
  occurred_at: string
}

export interface StockCount {
  product_id: string
  lot_id: string
  counted: number
}

export interface StockTakeInput {
  id: string
  location_id: string
  occurred_at: string
  counts: StockCount[]
}

export interface StockAdjustment {
  product_id: string
  lot_id: string
  expected: number
  counted: number
  delta: number
}

export interface StockTakeResult {
  id: string
  adjustments: StockAdjustment[]
}

export interface MovementFilter {
  product_id?: string
  lot_id?: string
  limit?: number
}

function query(filter: MovementFilter): string {
  const params = new URLSearchParams()
  if (filter.product_id) params.set('product_id', filter.product_id)
  if (filter.lot_id) params.set('lot_id', filter.lot_id)
  if (filter.limit) params.set('limit', String(filter.limit))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const stockApi = {
  list: () => api.get<StockRow[]>('/stock'),
  movements: (filter: MovementFilter = {}) =>
    api.get<StockMovement[]>(`/stock/movements${query(filter)}`),
  awaitingRelease: () => api.get<AwaitingRelease[]>('/stock/awaiting-release'),
  cannerAwaiting: () => api.get<CannerAwaiting[]>('/stock/canner-awaiting-receipt'),
  receiveCans: (body: CannerReceiptInput) => api.post<unknown>('/stock/canner-receipts', body),
  transfer: (body: TransferInput) => api.post<unknown>('/stock/transfers', body),
  breakage: (body: BreakageInput) => api.post<unknown>('/stock/breakages', body),
  take: (body: StockTakeInput) => api.post<StockTakeResult>('/stock/takes', body),
}
