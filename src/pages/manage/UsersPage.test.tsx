import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { UsersPage } from './UsersPage'
import { usersApi } from '../../api/management'
import type { User } from '../../api/management'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/management', () => ({
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    changeLog: vi.fn(),
  },
}))
const api = vi.mocked(usersApi)

const sam: User = {
  id: '1',
  email: 'sam@wwc.co',
  name: 'Sam',
  role: 'admin',
  status: 'active',
  last_sign_in_at: null,
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.list.mockResolvedValue([sam])
    api.changeLog.mockResolvedValue([])
    api.create.mockResolvedValue({ ...sam, id: '2' })
    api.deactivate.mockResolvedValue({ ...sam, status: 'deactivated' })
  })

  it('renders the users and the role cards', async () => {
    renderWithClient(<UsersPage />)
    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('sam@wwc.co')).toBeInTheDocument()
    // Role reference cards.
    expect(screen.getByText('Cellar')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('requires a valid email and an 8+ char password before creating', async () => {
    const { user } = renderWithClient(<UsersPage />)
    await screen.findByText('Sam')
    await user.click(screen.getByRole('button', { name: /Add user/ }))

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Initial password'), 'short')
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'mo@wwc.co')
    await user.clear(screen.getByLabelText('Initial password'))
    await user.type(screen.getByLabelText('Initial password'), 'longenough')
    const createBtn = screen.getByRole('button', { name: 'Create user' })
    expect(createBtn).toBeEnabled()

    await user.click(createBtn)
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mo@wwc.co', password: 'longenough', role: 'cellar' }),
    )
  })

  it('deactivates an existing user', async () => {
    const { user } = renderWithClient(<UsersPage />)
    await user.click(await screen.findByText('Sam'))
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(api.deactivate).toHaveBeenCalledWith('1'))
  })
})
