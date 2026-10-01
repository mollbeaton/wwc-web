import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { useAuth } from './AuthContext'
import { ApiError } from '../api/client'
import type { CurrentUser } from '../api/types'
import { renderWithClient } from '../test/utils'

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }))
const mockedUseAuth = vi.mocked(useAuth)

function auth(overrides: Partial<ReturnType<typeof useAuth>>): ReturnType<typeof useAuth> {
  return {
    user: null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    previewRole: null,
    setPreviewRole: vi.fn(),
    effectiveRole: null,
    ...overrides,
  }
}

function renderLogin() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tanks" element={<div>Tanks screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => mockedUseAuth.mockReset())

  it('redirects to the app when already signed in', () => {
    const user: CurrentUser = { id: '1', email: 'a@b.co', role: 'admin' }
    mockedUseAuth.mockReturnValue(auth({ user }))
    renderLogin()
    // The redirect (if (user) return <Navigate/>) was the fix for "login works
    // but nothing happens" - landing on /login while authed must leave it.
    expect(screen.getByText('Tanks screen')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('shows a friendly error and re-enables the button on a 401', async () => {
    const signIn = vi.fn().mockRejectedValue(new ApiError(401, null))
    mockedUseAuth.mockReturnValue(auth({ user: null, signIn }))
    const { user: typer } = renderLogin()

    await typer.type(screen.getByLabelText('Email'), 'a@b.co')
    await typer.type(screen.getByLabelText('Password'), 'wrong')
    await typer.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/don.t match/)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'wrong')
  })
})
