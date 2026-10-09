import { api } from './client'

/** One box on the trace diagram: a harvest, a milled batch, a bought-in juice
 *  delivery, or a lot. The API places it (column, row) so the diagram and the
 *  PDF report always draw the same picture. */
export interface TraceNode {
  id: string
  type: 'harvest' | 'batch' | 'intake' | 'lot'
  /** focus: the subject · line: its direct line · related: shares its fruit */
  role: 'focus' | 'line' | 'related'
  title: string
  subtitle: string
  occurred_at: string | null
  lot_id: string | null
  lot_kind: string | null
  status: string | null
  vessel_code: string | null
  volume_l: string | null
  unit_volume_l: string | null
  unit_count: number | null
  /** Harvest trace only: the share of this lot that came from the harvest (0-1). */
  harvest_share: string | null
  harvest_id: string | null
  /** Harvest nodes: the harvest's code, shown under its varieties. */
  reference: string | null
  column: number
  row: number
}

export interface TraceEdge {
  source: string
  target: string
  type: 'milled' | 'pressed' | 'intake' | 'split' | 'blend' | 'package'
  role: 'line' | 'related'
  occurred_at: string | null
  volume_l: string | null
  weight_kg: string | null
}

export interface RecallLine {
  category: 'ready_for_sale' | 'packaged' | 'in_tank'
  lot_kind: string
  unit_volume_l: string | null
  units: number | null
  volume_l: string
}

export interface TraceGraph {
  subject_type: 'lot' | 'harvest'
  subject_id: string
  nodes: TraceNode[]
  edges: TraceEdge[]
  /** The subject and everything after it on its direct line. */
  recall_direct: RecallLine[]
  /** Everything in the graph, related lots included. */
  recall_family: RecallLine[]
}

export const traceApi = {
  lot: (lotId: string) => api.get<TraceGraph>(`/lots/${lotId}/trace/graph`),
  harvest: (harvestId: string) => api.get<TraceGraph>(`/harvests/${harvestId}/trace/graph`),
}
