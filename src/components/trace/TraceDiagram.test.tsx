import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { TraceEdge, TraceGraph, TraceNode } from '../../api/trace'
import { renderWithClient } from '../../test/utils'
import { RecallSummary } from './RecallSummary'
import { TraceDiagram } from './TraceDiagram'

function node(id: string, extra: Partial<TraceNode>): TraceNode {
  return {
    id,
    type: 'lot',
    role: 'line',
    title: id,
    subtitle: 'Tank lot',
    occurred_at: null,
    lot_id: id,
    lot_kind: 'tank',
    status: 'active',
    vessel_code: null,
    volume_l: '100.00',
    unit_volume_l: null,
    unit_count: null,
    harvest_share: null,
    harvest_id: null,
    reference: null,
    column: 2,
    row: 0,
    ...extra,
  }
}

function edge(source: string, target: string, extra: Partial<TraceEdge> = {}): TraceEdge {
  return {
    source,
    target,
    type: 'blend',
    role: 'line',
    occurred_at: '2026-07-10T09:00:00Z',
    volume_l: '100.00',
    weight_kg: null,
    ...extra,
  }
}

const graph: TraceGraph = {
  subject_type: 'lot',
  subject_id: 'BLEND',
  nodes: [
    node('H-1', { type: 'harvest', title: 'H-1 · Dabinett', lot_id: null, harvest_id: 'h1', column: 0 }),
    node('PARENT', { column: 2, row: 0 }),
    node('OTHER', { column: 2, row: 1, role: 'related' }),
    node('BLEND', { column: 3, row: 0, role: 'focus' }),
  ],
  edges: [edge('PARENT', 'BLEND', { volume_l: '120.00' }), edge('PARENT', 'OTHER', { type: 'split', role: 'related', volume_l: '50.00' })],
  recall_direct: [],
  recall_family: [],
}

function renderDiagram() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/lots/BLEND']}>
      <Routes>
        <Route path="/lots/BLEND" element={<TraceDiagram graph={graph} />} />
        <Route path="/lots/:id" element={<p>Opened lot page</p>} />
        <Route path="/harvests/:id" element={<p>Opened harvest page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TraceDiagram', () => {
  it('draws every node and labels the links with litres', () => {
    renderDiagram()
    for (const title of ['H-1 · Dabinett', 'PARENT', 'OTHER', 'BLEND']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('120 L')).toBeInTheDocument()
    expect(screen.getByText('50 L')).toBeInTheDocument()
  })

  it('shows related lots by default and can hide them', async () => {
    const { user } = renderDiagram()
    const toggle = screen.getByLabelText('Show lots sharing this fruit')
    expect(toggle).toBeChecked()

    await user.click(toggle)
    expect(screen.queryByText('OTHER')).not.toBeInTheDocument()
    expect(screen.queryByText('50 L')).not.toBeInTheDocument()
    expect(screen.getAllByText('PARENT').length).toBeGreaterThan(0)
  })

  it('opens another lot or a harvest, but the subject itself is not a link', async () => {
    const { user } = renderDiagram()
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('aria-label'))).not.toContain('BLEND, Tank lot')

    await user.click(screen.getByRole('link', { name: 'PARENT, Tank lot' }))
    expect(screen.getByText('Opened lot page')).toBeInTheDocument()
  })
})

describe('RecallSummary', () => {
  it('describes product in units and litres, not lots', () => {
    renderWithClient(
      <RecallSummary
        title="Where it is now"
        lines={[
          { category: 'ready_for_sale', lot_kind: 'bottle', unit_volume_l: '0.750', units: 48, volume_l: '36.00' },
          { category: 'in_tank', lot_kind: 'tank', unit_volume_l: null, units: null, volume_l: '164.00' },
        ]}
      />,
    )
    expect(screen.getByText('48 × 0.75 L bottles · 36 L')).toBeInTheDocument()
    expect(screen.getByText('164 L')).toBeInTheDocument()
    expect(screen.getByText('Ready for sale')).toBeInTheDocument()
    expect(screen.getByText('Still in tanks')).toBeInTheDocument()
  })
})
