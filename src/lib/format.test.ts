import { describe, expect, it } from 'vitest'
import { gbp, vesselTypeLabel } from './format'

describe('gbp', () => {
  it('formats a positive amount', () => {
    expect(gbp('10.39')).toBe('£10.39')
  })

  it('puts a minus before the pound sign for a credit', () => {
    expect(gbp('-14.20')).toBe('−£14.20')
  })

  it('treats zero as zero, not a credit', () => {
    expect(gbp('0.00')).toBe('£0.00')
    expect(gbp('-0.00')).toBe('£0.00')
  })
})

describe('vesselTypeLabel', () => {
  it('keeps IBC as an acronym and capitalises the rest', () => {
    expect(vesselTypeLabel('ibc')).toBe('IBC')
    expect(vesselTypeLabel('barrel')).toBe('Barrel')
  })
})
