import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { ApiError, downloadFile } from '../api/client'
import { renderWithClient } from '../test/utils'
import { DownloadButton } from './DownloadButton'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, downloadFile: vi.fn() }
})

describe('DownloadButton', () => {
  it('says when a download failed, and retries it', async () => {
    vi.mocked(downloadFile)
      .mockRejectedValueOnce(new ApiError(500, 'Could not download the file'))
      .mockResolvedValueOnce()
    const { user } = renderWithClient(
      <DownloadButton path="/lots/1/trace/report.pdf" filename="trace.pdf">
        PDF report
      </DownloadButton>,
    )

    await user.click(screen.getByRole('button', { name: /PDF report/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not download the file')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(downloadFile).toHaveBeenCalledTimes(2)
  })
})
