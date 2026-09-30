import { api } from './client'

export interface TankLot {
  lot_id: string
  code: string
  name: string | null
  product_type: 'cider' | 'wine' | null
  varieties: string[]
  current_volume_l: string
  fill_pct: number
  latest_sg: string | null
  abv: string | null
  abv_method: 'calculated' | 'manual' | null
  last_event_at: string | null
  days_since_last_event: number | null
}

export interface VesselCard {
  vessel_id: string
  code: string
  name: string | null
  type: string
  capacity_l: string
  lot: TankLot | null
}

export interface TankSummary {
  cider_litres: string
  wine_litres: string
  empty_vessel_count: number
  released_this_month_l: string
}

export interface TankOverview {
  vessels: VesselCard[]
  summary: TankSummary
}

export const tanksApi = {
  overview: () => api.get<TankOverview>('/tanks/overview'),
}
