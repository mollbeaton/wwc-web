import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { WriteOffModal } from './WriteOffModal'
import { stockApi, type StockRow } from '../../api/stock'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/stock', () => ({ stockApi: { writeOff: vi.fn() } }))

const row: StockRow = {
  product_id: 'p-btl',
  code: 'WWC-BTL',
  name: 'Medium dry 500ml',
  kind: 'bottle',
  unit_volume_l: '0.5',
  on_hand: 24,
  by_location: [{ location_id: 'loc-shop', location_name: 'Shop', qty: 24 }],
  lots: [],
  xero_qty: 24,
  sync_state: 'in_sync',
  drift: 0,
}

describe('WriteOffModal', () => {
  it('needs a reason before it will write anything off', async () => {
    vi.mocked(stockApi.writeOff).mockResolvedValue({})
    const onClose = vi.fn()
    const { user } = renderWithClient(<WriteOffModal stock={[row]} onClose={onClose} />)

    await user.type(screen.getByLabelText('Units'), '2')
    const submit = screen.getByRole('button', { name: 'Write off' })
    // Nothing is picked by default: which Xero account it hits is a choice.
    expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /Tasting \/ samples/ }))
    expect(screen.getByText(/samples account/)).toBeInTheDocument()
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(stockApi.writeOff).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 'p-btl', location_id: 'loc-shop', qty: 2, reason: 'tasting' }),
    )
  })
})
