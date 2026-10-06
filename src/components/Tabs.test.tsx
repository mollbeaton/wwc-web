import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { Tabs } from './Tabs'
import { renderWithClient } from '../test/utils'

function Harness() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a')
  return (
    <Tabs
      tabs={[
        { value: 'a', label: 'History' },
        { value: 'b', label: 'Backward' },
        { value: 'c', label: 'Forward' },
      ]}
      active={tab}
      onChange={setTab}
    />
  )
}

describe('Tabs', () => {
  it('puts only the selected tab in the Tab order', () => {
    renderWithClient(<Harness />)
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Backward' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const { user } = renderWithClient(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'History' }))

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Backward' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Backward' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Forward' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
  })
})
