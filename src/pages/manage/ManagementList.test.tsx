import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { ManagementList, type ManagementListConfig } from './ManagementList'
import { makeFakeReferenceApi } from '../../test/fakeReferenceApi'
import { renderWithClient } from '../../test/utils'
import type { RefItem, ReferenceListApi } from '../../api/referenceLists'

function config(api: ReferenceListApi): ManagementListConfig {
  return {
    title: 'Varieties',
    subtitle: 'Apple, pear and grape varieties',
    addLabel: 'Add variety',
    queryKey: `varieties-${Math.random()}`,
    api,
    gridTemplate: '1fr 1fr 70px 90px',
    filterField: 'fruit',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'fruit', label: 'Fruit' },
      { key: 'used_count', label: 'Used' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      {
        key: 'fruit',
        label: 'Fruit',
        type: 'select',
        options: [
          { value: 'apple', label: 'Apple' },
          { value: 'pear', label: 'Pear' },
          { value: 'grape', label: 'Grape' },
        ],
      },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  }
}

const seed = [
  { id: '1', name: 'Dabinett', fruit: 'apple' },
  { id: '2', name: 'Bacchus', fruit: 'grape' },
]

describe('ManagementList', () => {
  it('renders the rows from the list', async () => {
    const api = makeFakeReferenceApi(seed)
    renderWithClient(<ManagementList config={config(api)} />)
    expect(await screen.findByText('Dabinett')).toBeInTheDocument()
    expect(screen.getByText('Bacchus')).toBeInTheDocument()
  })

  it('filters by the search box and shows "No matches" when nothing matches', async () => {
    const api = makeFakeReferenceApi(seed)
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')

    const search = screen.getByRole('searchbox')
    await user.type(search, 'dab')
    expect(screen.getByText('Dabinett')).toBeInTheDocument()
    expect(screen.queryByText('Bacchus')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText('No matches.')).toBeInTheDocument()
  })

  it('filters by the category (fruit) chips', async () => {
    const api = makeFakeReferenceApi(seed)
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')

    await user.click(screen.getByRole('button', { name: 'Grape' }))
    expect(screen.getByText('Bacchus')).toBeInTheDocument()
    expect(screen.queryByText('Dabinett')).not.toBeInTheDocument()
  })

  it('defaults a select to its first option so an untouched dropdown is not submitted empty', async () => {
    // Regression: a controlled <select value=""> showed "Apple" but submitted "".
    const api = makeFakeReferenceApi(seed)
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')

    await user.click(screen.getByRole('button', { name: /Add variety/ }))
    await user.type(screen.getByLabelText('Name'), 'Thorn')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thorn', fruit: 'apple' }))
  })

  it('warns and blocks save on a duplicate name', async () => {
    const api = makeFakeReferenceApi(seed)
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')

    await user.click(screen.getByRole('button', { name: /Add variety/ }))
    await user.type(screen.getByLabelText('Name'), 'Dabinett')

    expect(screen.getByText(/already exists/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(api.create).not.toHaveBeenCalled()
  })

  it('adds a new row through the create flow', async () => {
    const api = makeFakeReferenceApi(seed)
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')

    await user.click(screen.getByRole('button', { name: /Add variety/ }))
    await user.type(screen.getByLabelText('Name'), 'Thorn')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Thorn')).toBeInTheDocument()
  })

  it('shows a loading state while the list is in flight', () => {
    const api = makeFakeReferenceApi(seed)
    api.list = vi.fn((): Promise<RefItem[]> => new Promise(() => {})) // never resolves
    renderWithClient(<ManagementList config={config(api)} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error state with retry when the list fails', async () => {
    const api = makeFakeReferenceApi(seed)
    api.list = vi.fn(async (): Promise<RefItem[]> => {
      throw new Error('boom')
    })
    renderWithClient(<ManagementList config={config(api)} />)
    expect(await screen.findByText(/Couldn.t load/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('hides retired items until "Show retired" is toggled', async () => {
    const api = makeFakeReferenceApi([
      { id: '1', name: 'Dabinett', fruit: 'apple', status: 'active' },
      { id: '2', name: 'Old Variety', fruit: 'apple', status: 'retired' },
    ])
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await screen.findByText('Dabinett')
    expect(screen.queryByText('Old Variety')).not.toBeInTheDocument()

    // Count stays correct even though the retired row is hidden.
    await user.click(screen.getByRole('checkbox', { name: /Show retired \(1\)/ }))
    expect(await screen.findByText('Old Variety')).toBeInTheDocument()
  })
})

describe('ManagementList with a code-primary config (vessels)', () => {
  function vesselConfig(api: ReferenceListApi): ManagementListConfig {
    return {
      title: 'Vessels',
      subtitle: '',
      addLabel: 'Add vessel',
      queryKey: `vessels-${Math.random()}`,
      api,
      gridTemplate: '1fr 1fr 1fr 60px 90px',
      primaryField: 'code',
      searchKeys: ['code', 'name'],
      isValid: (f) => Number(f.capacity_l) > 0,
      columns: [
        { key: 'code', label: 'Vessel' },
        { key: 'type', label: 'Type' },
        { key: 'capacity_l', label: 'Capacity' },
        { key: 'used_count', label: 'Used' },
      ],
      fields: [
        { key: 'code', label: 'Code', type: 'text' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'capacity_l', label: 'Capacity (L)', type: 'number' },
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { value: 'tank', label: 'Tank' },
            { value: 'barrel', label: 'Barrel' },
          ],
        },
      ],
    }
  }

  it('keeps save disabled until the custom validation (capacity > 0) passes', async () => {
    const api = makeFakeReferenceApi([{ id: '1', code: 'FV1', capacity_l: '1000', type: 'tank' }])
    const { user } = renderWithClient(<ManagementList config={vesselConfig(api)} />)
    await screen.findByText('FV1')

    await user.click(screen.getByRole('button', { name: /Add vessel/ }))
    await user.type(screen.getByLabelText('Code'), 'FV2')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled() // no capacity yet
    await user.type(screen.getByLabelText('Capacity (L)'), '500')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('flags a duplicate on the primary field (code), not name', async () => {
    const api = makeFakeReferenceApi([{ id: '1', code: 'FV1', capacity_l: '1000', type: 'tank' }])
    const { user } = renderWithClient(<ManagementList config={vesselConfig(api)} />)
    await screen.findByText('FV1')

    await user.click(screen.getByRole('button', { name: /Add vessel/ }))
    await user.type(screen.getByLabelText('Code'), 'FV1')
    expect(screen.getByText(/already exists/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
