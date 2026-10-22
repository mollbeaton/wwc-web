import { describe, expect, it } from 'vitest'
import { explainDifference } from './closeOut'
import type { CloseOutLine } from '../../api/catalog'
import type { StockRow } from '../../api/stock'

const line = (product_id: string, unit_price: string, sold: number): CloseOutLine => ({
  product_id,
  code: product_id,
  name: product_id,
  at_event: sold,
  returned: 0,
  written_off: 0,
  sold,
  unit_price,
  value: '0',
})
const stock = [
  { product_id: 'can', kind: 'can' },
  { product_id: 'btl', kind: 'bottle' },
] as StockRow[]

describe('explainDifference', () => {
  it('sizes a shortfall in the product it fits best', () => {
    expect(explainDifference('-6.50', [line('can', '2.80', 90), line('btl', '6.50', 52)], stock)).toBe(
      '£6.50 less than list price - about 1 bottle at £6.50. Record any tastings or gifts above, or post it as a discount.',
    )
  })

  it('says when takings are over, and when they match', () => {
    expect(explainDifference('5.60', [line('can', '2.80', 90)], stock)).toMatch(/^£5.60 more than list price - about 2 cans/)
    expect(explainDifference('0.00', [line('can', '2.80', 90)], stock)).toBe('Takings match list price exactly.')
  })
})
