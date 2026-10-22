import { api } from './client'

// Xero sync. In the prototype the API talks to a stubbed Xero (`mode` is
// "fake"), so the /xero/fake/* reads show what "Xero" holds and /xero/dev/*
// lets a demo break things on purpose.

export interface XeroAccounts {
  sales: string
  cogs: string
  inventory: string
  production_clearing: string
  write_off: string
  opening_clearing: string
  samples: string
  gifts: string
  staff: string
}

export interface XeroStatus {
  mode: string
  connected: boolean
  tenant_name: string | null
  invoice_status: string
  accounts: XeroAccounts
  worker_enabled: boolean
  last_run_at: string | null
  counts: { pending: number; failed: number; needs_attention: number }
}

export type XeroJobKind =
  | 'contact_create'
  | 'item_upsert'
  | 'release_bill'
  | 'invoice_create'
  | 'credit_create'
  | 'adjustment'
  | 'drift_correction'
  | 'inbound'

export type XeroJobStatus = 'pending' | 'done' | 'failed' | 'needs_attention' | 'cancelled'

export interface XeroJob {
  id: string
  kind: XeroJobKind
  label: string
  status: XeroJobStatus
  attempts: number
  next_attempt_at: string | null
  last_error: string | null
  xero_id: string | null
  created_at: string
  completed_at: string | null
}

export interface XeroDrift {
  product_id: string
  code: string
  name: string
  wwc_qty: number
  xero_qty: number
  delta: number
  state: string
}

export interface FakeXeroItem {
  code: string
  name: string
  quantity_on_hand: number
  total_cost_pool: string
  average_cost: string
}

export type FakeXeroDocType = 'ACCREC' | 'ACCPAY' | 'ACCRECCREDIT' | 'ACCPAYCREDIT'

export interface FakeXeroDocLine {
  item_code: string | null
  description: string
  quantity: number
  unit_amount: string
  account_code: string | null
  cogs: string | null
  /** Tracking categories on the line, e.g. Location: Bristol Cider Festival. */
  tracking?: { name: string; option: string }[]
}

export interface FakeXeroDocument {
  id: string
  type: FakeXeroDocType
  number: string | null
  reference: string | null
  contact_name: string | null
  status: string
  total: string
  created_by_app: boolean
  date: string
  lines: FakeXeroDocLine[]
}

export type FailMode = 'rate_limit' | 'server_error' | 'validation'

export interface XeroSettingsInput {
  invoice_status?: string
  accounts?: XeroAccounts
}

export const xeroApi = {
  status: () => api.get<XeroStatus>('/xero/status'),
  connect: () => api.post<unknown>('/xero/connect'),
  disconnect: () => api.post<unknown>('/xero/disconnect'),
  saveSettings: (body: XeroSettingsInput) => api.put<unknown>('/xero/settings', body),
  jobs: (status?: XeroJobStatus) =>
    api.get<XeroJob[]>(status ? `/xero/jobs?status=${status}` : '/xero/jobs'),
  retryJob: (id: string) => api.post<unknown>(`/xero/jobs/${id}/retry`),
  cancelJob: (id: string) => api.post<unknown>(`/xero/jobs/${id}/cancel`),
  syncNow: () => api.post<{ processed: number }>('/xero/sync-now'),
  drift: () => api.get<XeroDrift[]>('/xero/drift'),
  correctDrift: (productId: string) => api.post<unknown>(`/xero/drift/${productId}/correct`),
  fakeItems: () => api.get<FakeXeroItem[]>('/xero/fake/items'),
  fakeDocuments: () => api.get<FakeXeroDocument[]>('/xero/fake/documents'),
}

/** Demo controls - only answered when the API runs against the stubbed Xero. */
export const xeroDevApi = {
  failNext: (mode: FailMode, count: number) => api.post<unknown>('/xero/dev/fail-next', { mode, count }),
  voidInvoice: (saleId: string) => api.post<unknown>('/xero/dev/void-invoice', { sale_id: saleId }),
  creditNote: (saleId: string, lines: { product_id: string; qty: number }[]) =>
    api.post<unknown>('/xero/dev/credit-note', { sale_id: saleId, lines }),
  manualInvoice: (customerId: string, lines: { product_id: string; qty: number; unit_price: string }[]) =>
    api.post<unknown>('/xero/dev/manual-invoice', { customer_id: customerId, lines }),
}

/** True when the API is talking to the stubbed Xero, not a real organisation. */
export function isStubbed(status: XeroStatus | undefined): boolean {
  return status?.mode === 'fake'
}
