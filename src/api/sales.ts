import { api } from './client'

export type XeroDocState = 'queued' | 'sent' | 'failed' | 'needs_attention' | 'cancelled'
export type XeroInvoiceStatus = 'AUTHORISED' | 'DRAFT' | 'PAID' | 'VOIDED'

/** Where a sale's invoice (or a return's credit note) is in Xero. */
export interface SaleXero {
  state: XeroDocState
  invoice_number: string | null
  invoice_status: XeroInvoiceStatus | null
  last_error: string | null
}

export type SaleStatus = 'confirmed' | 'voided' | 'unallocated'

export interface SaleSummary {
  id: string
  number: number
  /** WWC-S-0001 for a sale, WWC-R-0001 for a return. */
  reference: string
  kind: 'sale' | 'return'
  status: SaleStatus
  customer_id: string
  customer_name: string
  location_id: string | null
  location_name: string | null
  sold_at: string
  total: string
  /** On a return: the sale it returns. */
  returns_sale_id: string | null
  xero: SaleXero
}

export interface SaleLine {
  id: string
  product_id: string
  product_code: string
  product_name: string
  lot_id: string | null
  lot_code: string | null
  qty: number
  unit_price: string
  line_total: string
  container_ids: string[]
  returned_qty: number
}

export interface SaleDetail extends SaleSummary {
  lines: SaleLine[]
}

export interface SaleLineInput {
  product_id: string
  qty: number
  lot_id?: string
  /** Omit to charge the customer's price; only an admin may send another. */
  unit_price?: string
  container_ids?: string[]
}

export interface SaleInput {
  id: string
  customer_id: string
  location_id: string
  sold_at: string
  lines: SaleLineInput[]
}

export interface ReturnInput {
  id: string
  occurred_at: string
  location_id?: string
  lines: { sale_line_id: string; qty: number }[]
}

export const salesApi = {
  list: (status?: SaleStatus) => api.get<SaleSummary[]>(status ? `/sales?status=${status}` : '/sales'),
  get: (id: string) => api.get<SaleDetail>(`/sales/${id}`),
  create: (body: SaleInput) => api.post<SaleDetail>('/sales', body),
  createReturn: (saleId: string, body: ReturnInput) =>
    api.post<SaleDetail>(`/sales/${saleId}/returns`, body),
  allocate: (saleId: string, locationId: string) =>
    api.post<SaleDetail>(`/sales/${saleId}/allocate`, { location_id: locationId }),
}
