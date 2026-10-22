import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { XeroChip } from './XeroChip'
import type { SaleXero } from '../../api/sales'

function chip(xero: Partial<SaleXero>) {
  render(
    <XeroChip xero={{ state: 'queued', invoice_number: null, invoice_status: null, last_error: null, ...xero }} />,
  )
}

describe('XeroChip', () => {
  it('shows a queued invoice', () => {
    chip({ state: 'queued' })
    expect(screen.getByText('Queued')).toHaveClass('pill--grey')
  })

  it('shows the invoice number and its Xero status once sent', () => {
    chip({ state: 'sent', invoice_number: 'INV-0042', invoice_status: 'AUTHORISED' })
    expect(screen.getByText('INV-0042')).toBeInTheDocument()
    expect(screen.getByText('· Authorised')).toBeInTheDocument()
    expect(screen.getByText('INV-0042').closest('.pill')).toHaveClass('pill--green')
  })

  it('greys out a voided invoice', () => {
    chip({ state: 'sent', invoice_number: 'INV-0042', invoice_status: 'VOIDED' })
    expect(screen.getByText('· Voided')).toBeInTheDocument()
    expect(screen.getByText('INV-0042').closest('.pill')).toHaveClass('pill--grey')
  })

  it('shows a failure with the last error as a tooltip', () => {
    chip({ state: 'failed', last_error: 'Rate limited' })
    expect(screen.getByText('Failed')).toHaveAttribute('title', 'Rate limited')
    expect(screen.getByText('Failed')).toHaveClass('pill--coral')
  })

  it('flags one that needs attention', () => {
    chip({ state: 'needs_attention', last_error: 'Contact is archived' })
    expect(screen.getByText('Needs attention')).toHaveClass('pill--amber')
    expect(screen.getByText('Needs attention')).toHaveAttribute('title', 'Contact is archived')
  })
})
