// Display helpers. The API returns money and decimals as already-rounded
// strings; these only format for display and never re-round a figure.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "£10.39" from the API's "10.39". */
export function gbp(value: string): string {
  const n = Number(value)
  return `£${n.toFixed(2)}`
}

/** A decimal string to a fixed number of places, for LPA and hl figures. */
export function fixed(value: string, places: number): string {
  return Number(value).toFixed(places)
}

/** "August 2026" from (2026, 8). */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`
}

/** "2026-27" from 2026 - a production year runs 1 Feb to 31 Jan. */
export function productionYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** An ISO date to "5 Jul 2026". */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
