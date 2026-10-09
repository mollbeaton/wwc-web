import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { harvestsApi, orchardsApi } from '../../api/harvests'
import { lotsApi, type Lot } from '../../api/lots'
import { renderWithClient } from '../../test/utils'
import { TraceIndex } from './TraceIndex'

vi.mock('../../api/lots', () => ({ lotsApi: { list: vi.fn() } }))
vi.mock('../../api/harvests', () => ({
  harvestsApi: { list: vi.fn() },
  orchardsApi: { list: vi.fn() },
}))

function lot(id: string, code: string): Lot {
  return { id, code, name: null, kind: 'bottle', status: 'active' } as Lot
}

function search(q: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/trace?q=${q}`]}>
      <Routes>
        <Route path="/trace" element={<TraceIndex />} />
        <Route path="/lots/:id" element={<p>Lot page</p>} />
        <Route path="/harvests/:id" element={<p>Harvest page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TraceIndex search', () => {
  beforeEach(() => {
    vi.mocked(lotsApi.list).mockResolvedValue([
      lot('1', 'WWC-26-0008'),
      lot('2', 'WWC-26-0018'),
    ])
    vi.mocked(harvestsApi.list).mockResolvedValue([])
    vi.mocked(orchardsApi.list).mockResolvedValue([])
  })

  it('goes straight to the lot when the search is its exact code', async () => {
    search('wwc-26-0008')
    expect(await screen.findByText('Lot page')).toBeInTheDocument()
  })

  it('lists matches for a partial code', async () => {
    search('008')
    expect(await screen.findByText('WWC-26-0008')).toBeInTheDocument()
    expect(screen.queryByText('Lot page')).not.toBeInTheDocument()
  })
})
