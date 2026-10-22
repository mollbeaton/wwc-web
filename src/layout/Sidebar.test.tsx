import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../auth/AuthContext'
import type { CurrentUser } from '../api/types'
import { renderWithClient } from '../test/utils'

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))
const mockedUseAuth = vi.mocked(useAuth)

function auth(user: CurrentUser | null): ReturnType<typeof useAuth> {
  return {
    user,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    previewRole: null,
    setPreviewRole: vi.fn(),
    effectiveRole: user?.role ?? null,
  }
}

function render(path = '/') {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar role preview', () => {
  beforeEach(() => mockedUseAuth.mockReset())

  it('shows the role-preview switcher to an admin', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '1', email: 'a@b.co', role: 'admin' }))
    render()
    expect(screen.getByText('Preview role')).toBeInTheDocument()
  })

  it('hides it from a cellar user (no self-escalating the UI)', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '2', email: 'c@b.co', role: 'cellar' }))
    render()
    expect(screen.queryByText('Preview role')).not.toBeInTheDocument()
  })

  it('hides it from a viewer', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '3', email: 'v@b.co', role: 'viewer' }))
    render()
    expect(screen.queryByText('Preview role')).not.toBeInTheDocument()
  })
})

describe('Sidebar active section', () => {
  beforeEach(() => mockedUseAuth.mockReturnValue(auth({ id: '1', email: 'a@b.co', role: 'admin' })))

  const isActive = (name: string) => screen.getByRole('link', { name }).className.includes('active')

  it('keeps Trace highlighted on a lot page', () => {
    render('/lots/abc')
    expect(isActive('Trace')).toBe(true)
    expect(isActive('Tanks')).toBe(false)
  })

  it('keeps Trace highlighted on a harvest page', () => {
    render('/harvests/h1')
    expect(isActive('Trace')).toBe(true)
  })

  it('highlights only the matching item elsewhere', () => {
    render('/tanks')
    expect(isActive('Tanks')).toBe(true)
    expect(isActive('Trace')).toBe(false)
  })
})

describe('Sidebar role visibility', () => {
  beforeEach(() => mockedUseAuth.mockReset())

  const links = () => screen.getAllByRole('link').map((l) => l.textContent)

  it('shows a seller the Stock section and Trace, but no cellar, duty or manage pages', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '4', email: 's@b.co', role: 'seller' }))
    render('/stock')
    expect(screen.getByText('Stock', { selector: 'div' })).toBeInTheDocument()
    expect(links()).toEqual(['Trace', 'Stock', 'Sales', 'Transfers', 'Stock take', 'Kegs'])
    expect(screen.queryByText('Manage')).not.toBeInTheDocument()
  })

  it('lets a viewer read the Stock pages but not the stock take', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '3', email: 'v@b.co', role: 'viewer' }))
    render('/stock')
    expect(links()).toEqual(expect.arrayContaining(['Tanks', 'Duty', 'Stock', 'Sales', 'Transfers', 'Kegs']))
    expect(links()).not.toContain('Stock take')
  })

  it('gives an admin the new Manage pages', () => {
    mockedUseAuth.mockReturnValue(auth({ id: '1', email: 'a@b.co', role: 'admin' }))
    render()
    for (const name of ['Products', 'Price lists', 'Locations', 'Customers', 'Xero']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('option', { name: 'Seller' })).toBeInTheDocument()
  })
})
