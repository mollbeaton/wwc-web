import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { ImportDialog } from './ImportDialog'
import { ManagementList, type ManagementListConfig } from './ManagementList'
import { makeFakeReferenceApi } from '../../test/fakeReferenceApi'
import { renderWithClient } from '../../test/utils'
import type { ReferenceListApi } from '../../api/referenceLists'

function config(api: ReferenceListApi): ManagementListConfig {
  return {
    title: 'Varieties',
    subtitle: '',
    addLabel: 'Add variety',
    queryKey: `v-${Math.random()}`,
    api,
    gridTemplate: '1fr 1fr 90px',
    importColumns: ['name', 'fruit'],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'fruit', label: 'Fruit' },
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
        ],
      },
    ],
  }
}

describe('ImportDialog', () => {
  it('previews the paste and creates only the valid new rows', async () => {
    const api = makeFakeReferenceApi([{ id: '1', name: 'Dabinett', fruit: 'apple' }])
    const onImported = vi.fn()
    const { user } = renderWithClient(
      <ImportDialog
        config={config(api)}
        existingPrimaries={['Dabinett']}
        onClose={vi.fn()}
        onImported={onImported}
      />,
    )

    // Dabinett already exists; Thorn is invalid fruit; Michelin is the only new valid row.
    await user.type(
      screen.getByLabelText('Rows to import'),
      'Dabinett, apple\nMichelin, apple\nThorn, quince',
    )

    expect(screen.getByText('1 to add')).toBeInTheDocument()
    expect(screen.getByText('1 already exist')).toBeInTheDocument()
    expect(screen.getByText('1 invalid')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import 1' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create).toHaveBeenCalledWith({ name: 'Michelin', fruit: 'apple', id: expect.any(String) })
    expect(await screen.findByText('Added 1')).toBeInTheDocument()
    expect(onImported).toHaveBeenCalled()
  })

  it('surfaces an Import button on a list that supports it', async () => {
    const api = makeFakeReferenceApi([])
    const { user } = renderWithClient(<ManagementList config={config(api)} />)
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Import' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
