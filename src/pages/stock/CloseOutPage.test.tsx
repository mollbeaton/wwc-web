import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CloseOutPage } from './CloseOutPage'
import { ApiError } from '../../api/client'
import { customersApi, locationsApi, type CloseOutBody, type Customer } from '../../api/catalog'
import { stockApi, type StockRow } from '../../api/stock'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/catalog', () => ({
  locationsApi: { list: vi.fn(), closeOutPreview: vi.fn(), closeOut: vi.fn() },
  customersApi: { list: vi.fn() },
}))
vi.mock('../../api/stock', () => ({ stockApi: { list: vi.fn() } }))

const customer = (id: string, name: string, kind: Customer['kind']): Customer => ({
  id,
  name,
  email: null,
  kind,
  price_list_id: null,
  price_list_name: null,
  xero_contact_id: null,
  xero_sync: 'synced',
})

const bottles: StockRow = {
  product_id: 'p-btl',
  code: 'WWC-BTL',
  name: 'Medium dry 500ml',
  kind: 'bottle',
  unit_volume_l: '0.5',
  on_hand: 72,
  by_location: [
    { location_id: 'loc-cellar', location_name: 'Cellar', qty: 48 },
    { location_id: 'loc-fest', location_name: 'Bristol Cider Festival', qty: 24 },
  ],
  lots: [
    { lot_id: 'lot-1', lot_code: 'B-0001', released_at: null, location_id: 'loc-fest', location_name: 'Bristol Cider Festival', qty: 24 },
    { lot_id: 'lot-2', lot_code: 'B-0002', released_at: null, location_id: 'loc-cellar', location_name: 'Cellar', qty: 48 },
  ],
  xero_qty: 72,
  sync_state: 'in_sync',
  drift: 0,
}

function render() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/stock/events/loc-fest/close-out']}>
      <Routes>
        <Route path="/stock/events/:locationId/close-out" element={<CloseOutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CloseOutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(locationsApi.list).mockResolvedValue([
      { id: 'loc-cellar', name: 'Cellar', kind: 'cellar', status: 'active' },
      { id: 'loc-fest', name: 'Bristol Cider Festival', kind: 'event', status: 'active' },
    ])
    vi.mocked(customersApi.list).mockResolvedValue([
      customer('c-pub', 'The Plough', 'trade'),
      customer('c-sumup', 'Event takings (SumUp)', 'event'),
    ])
    vi.mocked(stockApi.list).mockResolvedValue([bottles])
    // The API's sums: 24 out, 10 back, 1 tasted → 13 sold at £6.50 = £84.50.
    vi.mocked(locationsApi.closeOutPreview).mockImplementation(async (_id, body: CloseOutBody) => {
      const returned = body.counts[0]?.returned ?? 0
      const writtenOff = body.write_offs.reduce((s, w) => s + w.qty, 0)
      const sold = 24 - returned - writtenOff
      const expected = (sold * 6.5).toFixed(2)
      return {
        lines: [
          {
            product_id: 'p-btl',
            code: 'WWC-BTL',
            name: 'Medium dry 500ml',
            at_event: 24,
            returned,
            written_off: writtenOff,
            sold,
            unit_price: '6.50',
            value: expected,
          },
        ],
        expected_takings: expected,
        takings: body.takings,
        difference: (Number(body.takings) - Number(expected)).toFixed(2),
      }
    })
    vi.mocked(locationsApi.closeOut).mockResolvedValue({
      id: 'co-1',
      location_id: 'loc-fest',
      takings: '78.00',
      expected_takings: '84.50',
      sale_id: 'sale-9',
    })
  })

  it('previews the reconciliation and explains the difference, then posts the counts, write-offs and takings', async () => {
    const { user } = render()

    // Only the lot at the event is listed, and the event customer is the default.
    const table = await screen.findByRole('table', { name: 'Stock at the event' })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByLabelText('Book the sale to')).toHaveValue('c-sumup')

    await user.type(screen.getByLabelText('Came back WWC-BTL B-0001'), '10')
    await user.click(screen.getByRole('button', { name: /Add write-off/ }))
    const writeOff = screen.getByRole('group', { name: 'Write-off 1' })
    await user.selectOptions(within(writeOff).getByLabelText('Product'), 'p-btl')
    await user.selectOptions(within(writeOff).getByLabelText('Reason'), 'tasting')
    await user.type(within(writeOff).getByLabelText('Note'), 'Festival tasting table')
    await user.type(screen.getByLabelText('Takings (£, ex VAT)'), '78')

    await waitFor(() => expect(screen.getByLabelText('Difference')).toHaveTextContent('−£6.50'))
    expect(screen.getByLabelText('Expected takings')).toHaveTextContent('£84.50')
    expect(
      screen.getByText(
        '£6.50 less than list price - about 1 bottle at £6.50. Record any tastings or gifts above, or post it as a discount.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Post close-out' }))
    await waitFor(() => expect(locationsApi.closeOut).toHaveBeenCalledTimes(1))
    const [locationId, body] = vi.mocked(locationsApi.closeOut).mock.calls[0]
    expect(locationId).toBe('loc-fest')
    expect(body).toMatchObject({
      customer_id: 'c-sumup',
      takings: '78.00',
      counts: [{ lot_id: 'lot-1', returned: 10 }],
      write_offs: [{ product_id: 'p-btl', qty: 1, reason: 'tasting', note: 'Festival tasting table' }],
    })
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)

    expect(await screen.findByRole('link', { name: 'View the sale' })).toHaveAttribute('href', '/sales/sale-9')
  })

  it('shows an API rule failure inline', async () => {
    vi.mocked(locationsApi.closeOut).mockRejectedValue(new ApiError(400, 'Takings must not be negative'))
    const { user } = render()
    await screen.findByRole('table', { name: 'Stock at the event' })
    await user.type(screen.getByLabelText('Takings (£, ex VAT)'), '10')
    await user.click(screen.getByRole('button', { name: 'Post close-out' }))
    expect(await screen.findByText('Takings must not be negative')).toBeInTheDocument()
  })
})
