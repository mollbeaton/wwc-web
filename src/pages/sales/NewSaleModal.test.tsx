import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { NewSaleModal } from './NewSaleModal'
import { customersApi, locationsApi, productsApi, type Customer, type Product } from '../../api/catalog'
import { kegsApi } from '../../api/kegs'
import { salesApi, type SaleDetail } from '../../api/sales'
import { stockApi, type StockRow } from '../../api/stock'
import type { Role } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/catalog', () => ({
  customersApi: { list: vi.fn(), prices: vi.fn(), create: vi.fn() },
  locationsApi: { list: vi.fn() },
  productsApi: { list: vi.fn() },
}))
vi.mock('../../api/kegs', () => ({ kegsApi: { list: vi.fn() } }))
vi.mock('../../api/sales', () => ({ salesApi: { create: vi.fn() } }))
vi.mock('../../api/stock', () => ({ stockApi: { list: vi.fn() } }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))

const bottle: Product = {
  id: 'p-btl',
  code: 'WWC-BTL',
  name: 'Medium dry 500ml',
  packaging_id: 'pk',
  packaging_name: '500ml bottle',
  kind: 'bottle',
  unit_volume_l: '0.5',
  standard_cost: '1.10',
  default_price: '3.00',
  status: 'active',
  xero_item_id: null,
  xero_sync: 'synced',
}

const pub: Customer = {
  id: 'c-pub',
  name: 'The Plough',
  email: null,
  kind: 'trade',
  price_list_id: 'pl-trade',
  price_list_name: 'Trade',
  xero_contact_id: null,
  xero_sync: 'synced',
}

const stock: StockRow = {
  product_id: 'p-btl',
  code: 'WWC-BTL',
  name: 'Medium dry 500ml',
  kind: 'bottle',
  unit_volume_l: '0.5',
  on_hand: 48,
  by_location: [{ location_id: 'loc-cellar', location_name: 'Cellar', qty: 48 }],
  lots: [
    {
      lot_id: 'lot-1',
      lot_code: 'B-0001',
      released_at: '2026-09-01T00:00:00Z',
      location_id: 'loc-cellar',
      location_name: 'Cellar',
      qty: 48,
    },
  ],
  xero_qty: 48,
  sync_state: 'in_sync',
  drift: 0,
}

function asRole(role: Role) {
  vi.mocked(useAuth).mockReturnValue({ effectiveRole: role } as ReturnType<typeof useAuth>)
}

async function fillSale(user: ReturnType<typeof renderWithClient>['user']) {
  await waitFor(() => expect(screen.getByRole('option', { name: 'The Plough' })).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText('Customer'), 'c-pub')
  await user.selectOptions(screen.getByLabelText('Location'), 'loc-cellar')
  await user.selectOptions(screen.getByLabelText('Product'), 'p-btl')
  await user.clear(screen.getByLabelText('Quantity'))
  await user.type(screen.getByLabelText('Quantity'), '12')
}

describe('NewSaleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(customersApi.list).mockResolvedValue([pub])
    // The trade list prices the bottle below its £3.00 default.
    vi.mocked(customersApi.prices).mockResolvedValue([
      { product_id: 'p-btl', unit_price: '2.40', source: 'price_list' },
    ])
    vi.mocked(locationsApi.list).mockResolvedValue([
      { id: 'loc-cellar', name: 'Cellar', kind: 'cellar', status: 'active' },
    ])
    vi.mocked(productsApi.list).mockResolvedValue([bottle])
    vi.mocked(stockApi.list).mockResolvedValue([stock])
    vi.mocked(kegsApi.list).mockResolvedValue([])
    vi.mocked(salesApi.create).mockResolvedValue({ id: 'sale-1' } as SaleDetail)
  })

  it('prefills the price from the customer’s price list and keeps it read-only for a seller', async () => {
    asRole('seller')
    const { user } = renderWithClient(<NewSaleModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await fillSale(user)

    const price = screen.getByLabelText('Unit price (£)')
    await waitFor(() => expect(price).toHaveValue(2.4))
    expect(price).toBeDisabled()
    expect(screen.getByLabelText('Running total')).toHaveTextContent('£28.80')

    await user.click(screen.getByRole('button', { name: 'Review sale' }))
    await user.click(screen.getByRole('button', { name: 'Confirm sale' }))
    await waitFor(() => expect(salesApi.create).toHaveBeenCalledTimes(1))

    // No unit_price: the API charges the price-list price itself.
    const body = vi.mocked(salesApi.create).mock.calls[0][0]
    expect(body).toMatchObject({ customer_id: 'c-pub', location_id: 'loc-cellar' })
    expect(body.lines).toEqual([{ product_id: 'p-btl', qty: 12 }])
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('lets an admin override the price, and sends it', async () => {
    asRole('admin')
    const { user } = renderWithClient(<NewSaleModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await fillSale(user)

    const price = screen.getByLabelText('Unit price (£)')
    await waitFor(() => expect(price).toHaveValue(2.4))
    expect(price).toBeEnabled()
    await user.clear(price)
    await user.type(price, '2')
    expect(screen.getByLabelText('Running total')).toHaveTextContent('£24.00')

    await user.click(screen.getByRole('button', { name: 'Review sale' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm sale' })
    expect(within(dialog).getByText('WWC-BTL')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm sale' }))
    await waitFor(() => expect(salesApi.create).toHaveBeenCalledTimes(1))
    expect(vi.mocked(salesApi.create).mock.calls[0][0].lines).toEqual([
      { product_id: 'p-btl', qty: 12, unit_price: '2.00' },
    ])
  })

  it('resends the same id when a failed confirm is retried', async () => {
    asRole('seller')
    vi.mocked(salesApi.create)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'sale-1' } as SaleDetail)
    const onCreated = vi.fn()
    const { user } = renderWithClient(<NewSaleModal onClose={vi.fn()} onCreated={onCreated} />)
    await fillSale(user)
    await waitFor(() => expect(screen.getByLabelText('Unit price (£)')).toHaveValue(2.4))

    await user.click(screen.getByRole('button', { name: 'Review sale' }))
    await user.click(screen.getByRole('button', { name: 'Confirm sale' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm sale' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const [first, retry] = vi.mocked(salesApi.create).mock.calls.map(([body]) => body.id)
    expect(retry).toBe(first)
  })
})
