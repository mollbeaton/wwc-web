import { api } from './client'
import type { ChangeLogEntry } from './management'

export interface Vessel {
  id: string
  code: string
  name: string | null
  capacity_l: string
  type: string
  status: 'active' | 'retired'
  display_order: number | null
  current_lot_ids: string[]
  used_count: number
}

export interface VesselInput {
  code?: string
  name?: string | null
  capacity_l?: string
  type?: string
  display_order?: number | null
}

export const vesselsApi = {
  list: () => api.get<Vessel[]>('/vessels'),
  create: (body: VesselInput) => api.post<Vessel>('/vessels', body),
  update: (id: string, body: VesselInput) => api.patch<Vessel>(`/vessels/${id}`, body),
  retire: (id: string) => api.post<Vessel>(`/vessels/${id}/retire`),
  restore: (id: string) => api.post<Vessel>(`/vessels/${id}/restore`),
  remove: (id: string) => api.del<void>(`/vessels/${id}`),
  changeLog: (id: string) => api.get<ChangeLogEntry[]>(`/vessels/${id}/change-log`),
}

export const VESSEL_TYPES = ['tank', 'barrel', 'ibc', 'other'] as const
