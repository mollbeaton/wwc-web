import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { Modal } from './Modal'
import { renderWithClient } from '../test/utils'

function Harness({ dismissable = true, autoFocus = false }: { dismissable?: boolean; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal title="Edit thing" onClose={() => setOpen(false)} dismissable={dismissable}>
          <input aria-label="First" autoFocus={autoFocus} />
          <button>Last</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('is a labelled dialog that focuses its first field', async () => {
    const { user } = renderWithClient(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'Edit thing' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveFocus()
  })

  it('closes on Escape and hands focus back to the opener', async () => {
    const { user } = renderWithClient(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('still returns focus to the opener when a field inside autofocuses', async () => {
    const { user } = renderWithClient(<Harness autoFocus />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(opener).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    const { user } = renderWithClient(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('ignores Escape while not dismissable (e.g. a save in flight)', async () => {
    const onClose = vi.fn()
    const { user } = renderWithClient(
      <Modal title="Saving" onClose={onClose} dismissable={false}>
        <button>Ok</button>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})
