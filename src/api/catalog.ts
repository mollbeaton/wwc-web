import { api } from './client'
import type { WriteOffReason } from './stock'

// What the business sells and who to: products, price lists, stock locations
// and customers. Money is a decimal string ex VAT, as everywhere else.

export type ProductKind = 'bottle' | 'bag_in_box' | 'can' | 'keg'
export type XeroSync = 'synced' | 'pending' | 'failed'

export interface Product {
  id: string
  code: string
  name: string
  packaging_id: string
  packaging_name: string
  kind: ProductKind
  unit_volume_l: string
  standard_cost: string
  default_price: string
  status: 'active' | 'retired'
  xero_item_id: string | null
  xero_sync: XeroSync
}

export interface ProductCreateInput {
  id: string
  code: string
  name: string
  packaging_id: string
  standard_cost: string
  default_price: string
}

export interface ProductUpdateInput {
  name?: string
  standard_cost?: string
  default_price?: string
  status?: 'active' | 'retired'
}

export interface PriceListItem {
  product_id: string
  unit_price: string
}

export interface PriceList {
  id: string
  name: string
  status: string
  items: PriceListItem[]
}

export type LocationKind = 'cellar' | 'shop' | 'event'

export interface StockLocation {
  id: string
  name: string
  kind: LocationKind
  status: 'active' | 'closed'
}

export type CustomerKind = 'trade' | 'shop' | 'event'

export interface Customer {
  id: string
  name: string
  email: string | null
  kind: CustomerKind
  price_list_id: string | null
  price_list_name: string | null
  xero_contact_id: string | null
  xero_sync: XeroSync
}

export interface CustomerCreateInput {
  id: string
  name: string
  email?: string
  kind: CustomerKind
  price_list_id?: string
}

export interface CustomerUpdateInput {
  email?: string | null
  kind?: CustomerKind
  price_list_id?: string | null
}

/** The price a customer pays for a product: from their price list, or the
 *  product's default when the list doesn't name it. */
export interface CustomerPrice {
  product_id: string
  unit_price: string
  source: 'price_list' | 'default'
}

export const productsApi = {
  list: () => api.get<Product[]>('/products'),
  create: (body: ProductCreateInput) => api.post<Product>('/products', body),
  update: (id: string, body: ProductUpdateInput) => api.patch<Product>(`/products/${id}`, body),
}

export const priceListsApi = {
  list: () => api.get<PriceList[]>('/price-lists'),
  create: (body: { id: string; name: string }) => api.post<PriceList>('/price-lists', body),
  /** Replaces every item on the list. */
  setItems: (id: string, items: PriceListItem[]) =>
    api.put<PriceList>(`/price-lists/${id}/items`, { items }),
}

/** An event's close-out: what came back, what was written off, and the
 *  takings. Lots at the event left out of `counts` are taken to have none
 *  left. Takings are a decimal string in GBP. */
export interface CloseOutBody {
  customer_id: string
  takings: string
  counts: { lot_id: string; returned: number }[]
  write_offs: { product_id: string; qty: number; reason: WriteOffReason; note?: string }[]
}

export interface CloseOutLine {
  product_id: string
  code: string
  name: string
  at_event: number
  returned: number
  written_off: number
  /** at_event - returned - written_off */
  sold: number
  unit_price: string
  value: string
}

export interface CloseOutPreview {
  lines: CloseOutLine[]
  expected_takings: string
  takings: string
  /** takings - expected_takings */
  difference: string
}

export interface CloseOutResult {
  id: string
  location_id: string
  takings: string
  expected_takings: string
  sale_id: string
}

export const locationsApi = {
  list: () => api.get<StockLocation[]>('/locations'),
  create: (body: { id: string; name: string; kind: LocationKind }) =>
    api.post<StockLocation>('/locations', body),
  close: (id: string) => api.post<StockLocation>(`/locations/${id}/close`),
  closeOutPreview: (id: string, body: CloseOutBody, signal?: AbortSignal) =>
    api.post<CloseOutPreview>(`/locations/${id}/close-out/preview`, body, { signal }),
  closeOut: (id: string, body: CloseOutBody & { id: string; occurred_at: string }) =>
    api.post<CloseOutResult>(`/locations/${id}/close-out`, body),
}

export const customersApi = {
  list: () => api.get<Customer[]>('/customers'),
  create: (body: CustomerCreateInput) => api.post<Customer>('/customers', body),
  update: (id: string, body: CustomerUpdateInput) => api.patch<Customer>(`/customers/${id}`, body),
  prices: (id: string) => api.get<CustomerPrice[]>(`/customers/${id}/prices`),
}
