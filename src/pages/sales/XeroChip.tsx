import type { SaleXero, XeroInvoiceStatus } from '../../api/sales'
import { cap } from '../../lib/format'

const INVOICE_PILL: Record<XeroInvoiceStatus, string> = {
  AUTHORISED: 'pill--green',
  PAID: 'pill--green',
  DRAFT: 'pill--blue',
  VOIDED: 'pill--grey',
}

/** Where a sale's invoice (or a return's credit note) is in Xero: queued, the
 *  document number with its Xero status once sent, or failed / needs
 *  attention (with the last error as a tooltip). */
export function XeroChip({ xero }: { xero: SaleXero }) {
  switch (xero.state) {
    case 'queued':
      return <span className="pill pill--grey">Queued</span>
    case 'sent': {
      const status = xero.invoice_status
      return (
        <span className={`pill ${status ? INVOICE_PILL[status] : 'pill--green'}`}>
          <span className="mono">{xero.invoice_number ?? 'Sent'}</span>
          {status && <span>· {cap(status.toLowerCase())}</span>}
        </span>
      )
    }
    case 'failed':
      return (
        <span className="pill pill--coral" title={xero.last_error ?? undefined}>
          Failed
        </span>
      )
    case 'needs_attention':
      return (
        <span className="pill pill--amber" title={xero.last_error ?? undefined}>
          Needs attention
        </span>
      )
    case 'cancelled':
      return <span className="pill pill--grey">Not sent</span>
  }
}
