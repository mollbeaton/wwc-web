import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { MonthlyReturn } from './MonthlyReturn'
import { dutyApi, type MonthlyReturn as MonthlyReturnData } from '../../api/duty'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/duty', () => ({
  dutyApi: { monthlyReturn: vi.fn(), filedMonths: vi.fn(), markFiled: vi.fn() },
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
const api = vi.mocked(dutyApi)

const openReturn: MonthlyReturnData = {
  period_year: 2026,
  period_month: 10,
  filed: false,
  filed_at: null,
  groups: [],
  adjustments: [],
  flags: [],
  total_lpa: '12.34',
  total_duty: '123.45',
}

describe('MonthlyReturn filing', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ effectiveRole: 'admin' } as ReturnType<typeof useAuth>)
    api.filedMonths.mockResolvedValue([])
    api.monthlyReturn.mockResolvedValue(openReturn)
    api.markFiled.mockReset()
  })

  it('asks for confirmation, showing the totals, before filing', async () => {
    api.markFiled.mockResolvedValue(undefined)
    const { user } = renderWithClient(<MonthlyReturn />)
    await user.click(await screen.findByRole('button', { name: 'Mark as filed' }))
    expect(api.markFiled).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('12.34 LPA')
    expect(dialog).toHaveTextContent('£123.45')

    await user.click(within(dialog).getByRole('button', { name: 'Mark as filed' }))
    await waitFor(() => expect(api.markFiled).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the dialog open and shows the error when filing fails', async () => {
    api.markFiled.mockRejectedValue(new ApiError(409, 'This month is already filed'))
    const { user } = renderWithClient(<MonthlyReturn />)
    await user.click(await screen.findByRole('button', { name: 'Mark as filed' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark as filed' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This month is already filed')
  })

  it('hides filing from a viewer', async () => {
    vi.mocked(useAuth).mockReturnValue({ effectiveRole: 'viewer' } as ReturnType<typeof useAuth>)
    renderWithClient(<MonthlyReturn />)
    await screen.findByRole('button', { name: 'Export CSV' })
    expect(screen.queryByRole('button', { name: 'Mark as filed' })).not.toBeInTheDocument()
  })
})
