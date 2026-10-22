import { api } from './client'

// Leased kegs: each one is tracked from the lessor, through filling and the
// customer, back to empty (or off-hire).

export type KegStatus = 'empty' | 'filled' | 'with_customer' | 'off_hired'

export interface Keg {
  id: string
  lessor: string
  lessor_keg_id: string
  size_l: string
  status: KegStatus
  lot_id: string | null
  lot_code: string | null
  product_name: string | null
  customer_id: string | null
  customer_name: string | null
  last_moved_at: string | null
  /** Set while the keg is with a customer. */
  days_out: number | null
}

export interface KegEvent {
  id: string
  type: string
  occurred_at: string
  lot_code: string | null
  customer_name: string | null
  sale_reference: string | null
}

export interface KegCreateInput {
  id: string
  lessor: string
  lessor_keg_id: string
  size_l: string
}

export const kegsApi = {
  list: () => api.get<Keg[]>('/kegs'),
  create: (body: KegCreateInput) => api.post<Keg>('/kegs', body),
  /** The empty keg is back from the customer. */
  markReturned: (id: string, occurred_at: string) => api.post<Keg>(`/kegs/${id}/return`, { occurred_at }),
  /** The keg goes back to the lessor. */
  offHire: (id: string, occurred_at: string) => api.post<Keg>(`/kegs/${id}/off-hire`, { occurred_at }),
  events: (id: string) => api.get<KegEvent[]>(`/kegs/${id}/events`),
}
