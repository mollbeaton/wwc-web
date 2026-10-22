import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReadyForSalePage } from './ReadyForSalePage'
import { lotsApi, type Lot } from '../../api/lots'
import { productsApi, type Product } from '../../api/catalog'
import { stockApi } from '../../api/stock'
import { useAuth } from '../../auth/AuthContext'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/lots', () => ({ lotsApi: { list: vi.fn(), markReadyForSale: vi.fn() } }))
vi.mock('../../api/stock', () => ({ stockApi: { awaitingRelease: vi.fn(), cannerAwaiting: vi.fn() } }))
vi.mock('../../api/catalog', () => ({ productsApi: { list: vi.fn() } }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
const api = vi.mocked(lotsApi)

function product(code: string, extra: Partial<Product> = {}): Product {
  return {
    id: code,
    code,
    name: code,
    packaging_id: 'pk',
    packaging_name: 'Pack',
    kind: 'bag_in_box',
    unit_volume_l: '10',
    standard_cost: '5.00',
    default_price: '30.00',
    status: 'active',
    xero_item_id: null,
    xero_sync: 'synced',
    ...extra,
  }
}

function lot(code: string, extra: Partial<Lot> = {}): Lot {
  return {
    id: code,
    code,
    name: null,
    status: 'active',
    still_fermenting: false,
    product_type: 'cider',
    display_type: 'cider',
    current_volume_l: '0',
    current_vessel_ids: [],
    latest_sg: null,
    abv: '6.4',
    abv_method: 'calculated',
    kind: 'bottle',
    unit_volume_l: '0.5',
    unit_count: 100,
    sparkling: true,
    closure: 'crown_cap',
    labelled_at: null,
    composition: [],
    parent_lot_ids: [],
    ready_for_sale_volume_l: '0',
    ready_for_sale_at: null,
    lost_volume_l: '0',
    ...extra,
  }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

function rowCodes(tableName: string): string[] {
  const table = screen.getByRole('table', { name: tableName })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].querySelector('.mono')!.textContent!)
}

function render() {
  return renderWithClient(
    <MemoryRouter>
      <ReadyForSalePage />
    </MemoryRouter>,
  )
}

describe('ReadyForSalePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ effectiveRole: 'cellar' } as ReturnType<typeof useAuth>)
    vi.mocked(stockApi.awaitingRelease).mockResolvedValue([])
    vi.mocked(stockApi.cannerAwaiting).mockResolvedValue([])
    vi.mocked(productsApi.list).mockResolvedValue([])
    api.list.mockResolvedValue([
      // Released, newest first regardless of list order.
      lot('B-OLD', { status: 'dispatched', ready_for_sale_volume_l: '50', ready_for_sale_at: daysAgo(200) }),
      lot('B-NEW', { status: 'dispatched', ready_for_sale_volume_l: '50', ready_for_sale_at: daysAgo(1) }),
      lot('C-MID', { kind: 'can', status: 'dispatched', ready_for_sale_volume_l: '330', ready_for_sale_at: daysAgo(40) }),
      // Packaged, waiting.
      lot('BIB-1', { kind: 'bag_in_box', unit_volume_l: '10', unit_count: 20, current_volume_l: '200', sparkling: null, closure: null }),
      // Not shown: a tank lot still in a vessel, and a tank lot packaged off.
      lot('T-1', { kind: 'tank', current_volume_l: '1800' }),
      lot('T-2', { kind: 'tank', status: 'packaged' }),
    ])
  })

  it('lists released lots newest first, and packaged lots awaiting release', async () => {
    render()
    await screen.findByRole('table', { name: 'Ready for sale' })
    expect(rowCodes('Ready for sale')).toEqual(['B-NEW', 'C-MID', 'B-OLD'])
    expect(rowCodes('Awaiting release')).toEqual(['BIB-1'])
  })

  it('shows the format, units and release volume, and links to the lot', async () => {
    render()
    const table = await screen.findByRole('table', { name: 'Ready for sale' })
    const newest = within(table).getAllByRole('row')[1]
    expect(newest).toHaveTextContent('Bottle')
    expect(newest).toHaveTextContent('100 × 0.5 L')
    expect(newest).toHaveTextContent('50.0 L')
    expect(newest).toHaveAttribute('href', '/lots/B-NEW')
  })

  it('narrows released lots by period', async () => {
    const { user } = render()
    await screen.findByRole('table', { name: 'Ready for sale' })

    await user.click(screen.getByRole('button', { name: 'Last 90 days' }))
    expect(rowCodes('Ready for sale')).toEqual(['B-NEW', 'C-MID'])

    // The awaiting list isn't affected by the release period.
    expect(rowCodes('Awaiting release')).toEqual(['BIB-1'])
  })

  it('says so when nothing is waiting', async () => {
    api.list.mockResolvedValue([])
    render()
    expect(await screen.findByText('Nothing packaged is waiting to be released.')).toBeInTheDocument()
    expect(screen.getByText('Nothing has been marked ready for sale yet.')).toBeInTheDocument()
  })

  it('marks an awaiting lot ready as a product of the same format', async () => {
    vi.mocked(stockApi.awaitingRelease).mockResolvedValue([
      {
        lot_id: 'BIB-1',
        lot_code: 'BIB-1',
        name: null,
        kind: 'bag_in_box',
        unit_volume_l: '10',
        unit_count: 20,
        product_id: null,
        product_type: 'cider',
      },
    ])
    vi.mocked(productsApi.list).mockResolvedValue([
      product('BIB10'),
      product('BIB5', { unit_volume_l: '5' }),
      product('BTL', { kind: 'bottle', unit_volume_l: '10' }),
    ])
    api.markReadyForSale.mockResolvedValue({})
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Mark ready for sale' }))
    const dialog = screen.getByRole('dialog', { name: 'Mark BIB-1 ready for sale' })
    const picker = within(dialog).getByLabelText('Product')
    await waitFor(() => expect(within(picker).getAllByRole('option')).toHaveLength(2))
    // Only the matching kind and unit size is offered.
    expect(within(picker).getByRole('option', { name: /BIB10/ })).toBeInTheDocument()

    await user.selectOptions(picker, 'BIB10')
    await user.click(within(dialog).getByRole('button', { name: 'Mark ready for sale' }))
    await waitFor(() => expect(api.markReadyForSale).toHaveBeenCalledTimes(1))
    expect(api.markReadyForSale).toHaveBeenCalledWith(
      'BIB-1',
      expect.objectContaining({ product_id: 'BIB10', product_type: 'cider', id: expect.any(String) }),
    )
  })
})
