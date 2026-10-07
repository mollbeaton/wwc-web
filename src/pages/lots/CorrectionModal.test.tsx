import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { CorrectionModal } from './CorrectionModal'
import { lotsApi, type LotEvent } from '../../api/lots'
import { renderWithClient } from '../../test/utils'

vi.mock('../../api/lots', () => ({ lotsApi: { correctLoss: vi.fn(), correctAddition: vi.fn() } }))
const api = vi.mocked(lotsApi)

const loss: LotEvent = {
  id: 'loss-1',
  occurred_at: '2026-10-01T10:00:00Z',
  recorded_at: '2026-10-01T10:00:00Z',
  recorded_by_email: null,
  is_backdated: false,
  event_type: 'loss',
  description: 'Loss',
  change: '−5 L',
  balance_l: '95',
  is_correction: false,
  corrects_event_id: null,
  is_corrected: false,
  is_abv_override: false,
  correctable: true,
  correct_kind: 'loss',
  addition_type: null,
  addition_amount: null,
  addition_unit: null,
  loss_volume_l: '5',
}

describe('CorrectionModal', () => {
  it('resends the same id when a failed save is retried', async () => {
    api.correctLoss.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({})
    const onClose = vi.fn()
    const { user } = renderWithClient(
      <CorrectionModal lotId="lot-1" event={loss} hasDutyLine={false} onClose={onClose} />,
    )

    await user.type(screen.getByLabelText('Reason (required)'), 'Misread the dipstick')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())

    const [first, retry] = api.correctLoss.mock.calls.map(([, , body]) => body.id)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(retry).toBe(first)
  })
})
