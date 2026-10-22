import type { CloseOutLine } from '../../api/catalog'
import type { StockRow } from '../../api/stock'
import { gbp } from '../../lib/format'

const UNIT_WORDS: Record<string, [string, string]> = {
  bottle: ['bottle', 'bottles'],
  can: ['can', 'cans'],
  bag_in_box: ['box', 'boxes'],
  keg: ['keg', 'kegs'],
}

/** Puts the takings difference in words, sized in units of whichever sold
 *  product it divides into most cleanly (so £6.50 short with bottles at
 *  £6.50 reads "about 1 bottle at £6.50", not "2 cans at £2.80"). */
export function explainDifference(difference: string, lines: CloseOutLine[], stock: StockRow[]): string {
  const diff = Number(difference)
  if (Math.abs(diff) < 0.005) return 'Takings match list price exactly.'
  const amount = gbp(String(Math.abs(diff)))
  const fits = lines
    .filter((l) => l.sold > 0 && Number(l.unit_price) > 0)
    .map((l) => {
      const ratio = Math.abs(diff) / Number(l.unit_price)
      return { line: l, n: Math.round(ratio), misfit: Math.abs(ratio - Math.round(ratio)) }
    })
    .filter((f) => f.n >= 1)
    .sort((a, b) => a.misfit - b.misfit || a.n - b.n)
  let about = ''
  if (fits[0]) {
    const { line, n } = fits[0]
    const kind = stock.find((r) => r.product_id === line.product_id)?.kind ?? ''
    const [one, many] = UNIT_WORDS[kind] ?? ['unit', 'units']
    about = ` - about ${n} ${n === 1 ? one : many} at ${gbp(line.unit_price)}`
  }
  return diff < 0
    ? `${amount} less than list price${about}. Record any tastings or gifts above, or post it as a discount.`
    : `${amount} more than list price${about}. Check the came-back counts, or post it as an adjustment.`
}
