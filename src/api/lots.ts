import { api } from './client'
import type { DutyLine } from './duty'

export interface LotComposition {
  variety: string
  volume_l: string
  harvest_id: string
  harvest_code: string
  harvested_on: string
  orchard_name: string
}

export interface Lot {
  id: string
  code: string
  name: string | null
  status: string
  // Whether the SG is still falling, derived by the API from the readings.
  still_fermenting: boolean
  product_type: 'cider' | 'wine' | null
  // What the lot shows as; perry = pear cider. Falls back to product_type.
  display_type: 'cider' | 'perry' | 'wine' | null
  current_volume_l: string
  current_vessel_ids: string[]
  latest_sg: string | null
  abv: string | null
  abv_method: 'calculated' | 'manual' | null
  kind: string
  unit_volume_l: string | null
  unit_count: number | null
  sparkling: boolean | null
  closure: string | null
  labelled_at: string | null
  composition: LotComposition[]
  parent_lot_ids: string[]
  ready_for_sale_volume_l: string
  /** When the lot was marked ready for sale (its duty point); null until then. */
  ready_for_sale_at: string | null
  lost_volume_l: string
}

export interface Reconciliation {
  lot_id: string
  starting_volume_l: string
  water_added_l: string
  lost_volume_l: string
  split_off_volume_l: string
  current_volume_l: string
  reconciles: boolean
}

export interface AdditionSummary {
  lot_id: string
  kind: string
  amount: string
  unit: string
  occurred_at: string
}

export interface BackwardTrace {
  lot_id: string
  ancestor_lot_ids: string[]
  additions: AdditionSummary[]
  intake_suppliers: string[]
  composition: LotComposition[]
}

export interface LotEvent {
  id: string
  occurred_at: string
  recorded_at: string
  recorded_by_email: string | null
  is_backdated: boolean
  event_type: string
  description: string
  change: string | null
  balance_l: string | null
  is_correction: boolean
  corrects_event_id: string | null
  is_corrected: boolean
  is_abv_override: boolean
  correctable: boolean
  correct_kind: 'addition' | 'loss' | null
  addition_type: string | null
  addition_amount: string | null
  addition_unit: string | null
  loss_volume_l: string | null
}

export interface LossCorrection {
  id: string
  occurred_at: string
  volume_l: string
  reason: string
}

export interface AdditionCorrection {
  id: string
  kind: string
  amount: string
  unit: string
  occurred_at: string
  note: string
}

export const lotsApi = {
  list: () => api.get<Lot[]>('/lots'),
  get: (lotId: string) => api.get<Lot>(`/lots/${lotId}`),
  reconciliation: (lotId: string) => api.get<Reconciliation>(`/lots/${lotId}/reconciliation`),
  dutyLine: (lotId: string) => api.get<DutyLine | null>(`/lots/${lotId}/duty`),
  backwardTrace: (lotId: string) => api.get<BackwardTrace>(`/lots/${lotId}/trace/backward`),
  events: (lotId: string) => api.get<LotEvent[]>(`/lots/${lotId}/events`),
  correctLoss: (lotId: string, lossId: string, body: LossCorrection) =>
    api.post<unknown>(`/lots/${lotId}/loss/${lossId}/correct`, body),
  correctAddition: (lotId: string, additionId: string, body: AdditionCorrection) =>
    api.post<unknown>(`/lots/${lotId}/additions/${additionId}/correct`, body),
}
