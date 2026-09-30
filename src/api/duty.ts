import { api } from './client'

// Money and other decimals arrive from the API as strings (Pydantic serialises
// Decimal that way), and we keep them as strings so no precision is lost - the
// API has already done every calculation and rounding (spec Principles).

export interface DutyLine {
  id: string
  lot_id: string
  lot_code: string
  duty_point_date: string
  production_date: string
  production_year: number
  period_year: number
  period_month: number
  volume_l: string
  abv: string
  abv_method: 'calculated' | 'manual'
  lpa: string
  category: string
  category_label: string
  spr_table: string | null
  full_rate: string
  spr_discount_per_lpa: string
  rate_charged: string
  duty_owed: string
  flag_manual_abv: boolean
  flag_cider_over_8_5: boolean
  is_adjustment: boolean
  adjusts_duty_line_id: string | null
}

export interface DutyReturnGroup {
  category: string
  category_label: string
  relief_table: string | null
  relief_table_label: string | null
  total_lpa: string
  total_duty: string
  lines: DutyLine[]
}

export interface DutyLineFlag {
  lot_code: string
  reason: string
}

export interface MonthlyReturn {
  period_year: number
  period_month: number
  filed: boolean
  filed_at: string | null
  groups: DutyReturnGroup[]
  adjustments: DutyLine[]
  flags: DutyLineFlag[]
  total_lpa: string
  total_duty: string
}

export interface SprTableRate {
  spr_table: string
  spr_table_label: string
  applies_to: string
  band_start_hl: string
  band_end_hl: string
  marginal_per_hl: string
  cumulative_gbp: string
  total_discount_gbp: string
  discount_per_lpa: string
  full_rate: string
  rate_charged: string
  working: string
}

export interface SprRates {
  production_year: number
  based_on_production_year: number
  basis_production_hl: string | null
  tables: SprTableRate[]
}

export interface FiledMonth {
  period_year: number
  period_month: number
  filed_at: string
}

export const dutyApi = {
  monthlyReturn: (year: number, month: number) =>
    api.get<MonthlyReturn>(`/duty/return/${year}/${month}`),
  markFiled: (year: number, month: number) =>
    api.post<void>('/duty/return/file', { period_year: year, period_month: month }),
  filedMonths: () => api.get<FiledMonth[]>('/duty/filed-months'),
  sprRates: (productionYear: number) => api.get<SprRates>(`/duty/spr-rates/${productionYear}`),
}
