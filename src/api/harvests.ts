import { api } from './client'
import type { ForwardTraceNode } from './lots'

export interface HarvestVariety {
  variety: string
  weight_kg: string | null
}

export interface Harvest {
  id: string
  code: string
  orchard_id: string
  fruit: string
  harvested_on: string
  notes: string | null
  varieties: HarvestVariety[]
  batch_stage_counts: Record<string, number>
}

export interface Orchard {
  id: string
  name: string
  type: string
}

export const harvestsApi = {
  list: () => api.get<Harvest[]>('/harvests'),
  get: (harvestId: string) => api.get<Harvest>(`/harvests/${harvestId}`),
  forwardTrace: (harvestId: string) =>
    api.get<ForwardTraceNode[]>(`/harvests/${harvestId}/trace/forward`),
}

export const orchardsApi = {
  list: () => api.get<Orchard[]>('/orchards'),
}
