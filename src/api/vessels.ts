import { api } from './client'

export interface Vessel {
  id: string
  code: string
  name: string | null
  capacity_l: string
  type: string
  status: string
  display_order: number | null
  current_lot_ids: string[]
}

export const vesselsApi = {
  list: () => api.get<Vessel[]>('/vessels'),
}
