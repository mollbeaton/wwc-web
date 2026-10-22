import { ApiError } from '../api/client'
import type { MovementType, StockMovement, WriteOffReason } from '../api/stock'

/** The message to show for a failed request: the API's own detail when there
 *  is one (it explains domain rules, e.g. "only 4 in stock"), else `fallback`. */
export function errorText(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

/** "5 Jul, 14:03" - for movements, jobs and keg events. */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A signed unit count: "+12", "−3" (true minus, to match the volume figures), "0". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  released: 'Released',
  sold: 'Sold',
  returned: 'Returned',
  written_off: 'Written off',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  count_adjustment: 'Stock take',
  opening: 'Opening stock',
}

export function movementLabel(type: MovementType): string {
  return MOVEMENT_LABELS[type] ?? type
}

/** The write-off reasons, in the order offered, with where each lands in Xero. */
export const WRITE_OFF_REASONS: { value: WriteOffReason; label: string; short: string; hint: string }[] = [
  { value: 'tasting', label: 'Tasting / samples', short: 'Tasting', hint: 'Posted to the samples account - a marketing cost.' },
  { value: 'gift', label: 'Gift', short: 'Gift', hint: 'Posted to the gifts account.' },
  {
    value: 'breakage',
    label: 'Breakage / spoiled',
    short: 'Breakage',
    hint: 'Posted to the write-off account - stock lost, not given.',
  },
  { value: 'own_use', label: 'Own use / staff', short: 'Own use', hint: 'Posted to the staff account.' },
]

/** "Written off · Tasting", or the plain movement label. */
export function movementText(m: Pick<StockMovement, 'type' | 'write_off_reason'>): string {
  const reason = m.write_off_reason && WRITE_OFF_REASONS.find((r) => r.value === m.write_off_reason)
  return reason ? `${movementLabel(m.type)} · ${reason.short}` : movementLabel(m.type)
}

/** Now, as the API wants it - every write carries when it happened. */
export function nowIso(): string {
  return new Date().toISOString()
}

/** A whole, positive unit count from a text field, or null. */
export function positiveInt(value: string): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** "12.50" from a typed price, or null if it isn't a non-negative amount. */
export function money(value: string): string | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null
}
