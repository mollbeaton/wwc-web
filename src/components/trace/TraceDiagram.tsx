import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TraceEdge, TraceGraph, TraceNode } from '../../api/trace'
import { shortDate } from '../../lib/format'
import styles from './TraceDiagram.module.css'

const NODE_W = 168
const NODE_H = 68
const COL_GAP = 56
const ROW_GAP = 18

const EDGE_VERBS: Record<TraceEdge['type'], string> = {
  milled: 'Milled',
  pressed: 'Pressed',
  intake: 'Bought in',
  split: 'Split',
  blend: 'Blended',
  package: 'Packaged',
}

/** The lineage diagram: fruit on the left, through every press, split, blend
 *  and packaging run, to where the product is now. The subject is
 *  highlighted, its direct line drawn solid, and lots that only share its
 *  fruit faded (shown by default - in a recall they're the point). The API
 *  lays it out; this only draws it. */
export function TraceDiagram({ graph }: { graph: TraceGraph }) {
  const [showRelated, setShowRelated] = useState(true)
  const navigate = useNavigate()
  const hasRelated = graph.nodes.some((n) => n.role === 'related')

  const nodes = graph.nodes.filter((n) => showRelated || n.role !== 'related')
  const visible = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter((e) => visible.has(e.source) && visible.has(e.target))
  const placed = compactRows(nodes)
  const at = new Map(placed.map((p) => [p.node.id, p]))

  const columns = Math.max(0, ...placed.map((p) => p.column)) + 1
  const rows = Math.max(0, ...placed.map((p) => p.row)) + 1
  const width = columns * (NODE_W + COL_GAP) - COL_GAP
  const height = rows * (NODE_H + ROW_GAP) - ROW_GAP

  // A long lineage is wider than the page: open scrolled so the subject is
  // in view rather than off past the right-hand edge.
  const scrollRef = useRef<HTMLDivElement>(null)
  const focus = placed.find((p) => p.node.role === 'focus')
  const focusX = focus ? x(focus) : 0
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = Math.max(0, focusX + NODE_W / 2 - el.clientWidth / 2)
  }, [focusX])

  function open(node: TraceNode) {
    if (node.role === 'focus') return
    if (node.type === 'lot' && node.lot_id) navigate(`/lots/${node.lot_id}`)
    if (node.type === 'harvest' && node.harvest_id) navigate(`/harvests/${node.harvest_id}`)
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Legend subject={graph.subject_type} />
        {hasRelated && (
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showRelated}
              onChange={(e) => setShowRelated(e.target.checked)}
            />
            Show lots sharing this fruit
          </label>
        )}
      </div>
      <div className={styles.scroll} ref={scrollRef}>
        <svg
          className={styles.svg}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Lineage diagram"
        >
          {edges.map((edge) => {
            const from = at.get(edge.source)
            const to = at.get(edge.target)
            if (!from || !to) return null
            return <Edge key={`${edge.source}-${edge.target}`} edge={edge} from={from} to={to} />
          })}
          {placed.map((p) => (
            <Node key={p.node.id} placed={p} onOpen={() => open(p.node)} />
          ))}
        </svg>
      </div>
    </div>
  )
}

interface Placed {
  node: TraceNode
  column: number
  row: number
}

/** With related lots hidden, close the gaps they leave in each column while
 *  keeping the API's order. */
function compactRows(nodes: TraceNode[]): Placed[] {
  const byColumn = new Map<number, TraceNode[]>()
  for (const n of nodes) byColumn.set(n.column, [...(byColumn.get(n.column) ?? []), n])
  const placed: Placed[] = []
  for (const [column, members] of byColumn) {
    members
      .sort((a, b) => a.row - b.row)
      .forEach((node, row) => placed.push({ node, column, row }))
  }
  return placed
}

function x(p: Placed) {
  return p.column * (NODE_W + COL_GAP)
}
function y(p: Placed) {
  return p.row * (NODE_H + ROW_GAP)
}

function Edge({ edge, from, to }: { edge: TraceEdge; from: Placed; to: Placed }) {
  const x1 = x(from) + NODE_W
  const y1 = y(from) + NODE_H / 2
  const x2 = x(to)
  const y2 = y(to) + NODE_H / 2
  const mid = (x1 + x2) / 2
  const amount = edge.volume_l
    ? `${trim(edge.volume_l)} L`
    : edge.weight_kg
      ? `${trim(edge.weight_kg)} kg`
      : ''
  const when = edge.occurred_at ? shortDate(edge.occurred_at) : ''
  const related = edge.role === 'related'
  return (
    <g className={related ? styles.related : undefined}>
      <title>{[EDGE_VERBS[edge.type], amount, when].filter(Boolean).join(' · ')}</title>
      <path
        d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 6},${y2}`}
        className={styles.edge}
        strokeDasharray={related ? '4 4' : undefined}
      />
      <path d={`M${x2 - 6},${y2 - 4} L${x2},${y2} L${x2 - 6},${y2 + 4} z`} className={styles.arrow} />
      {amount && (
        <text x={mid} y={(y1 + y2) / 2 - 5} className={styles.edgeLabel} textAnchor="middle">
          {amount}
        </text>
      )}
    </g>
  )
}

function Node({ placed, onOpen }: { placed: Placed; onOpen: () => void }) {
  const { node } = placed
  const clickable =
    node.role !== 'focus' &&
    ((node.type === 'lot' && !!node.lot_id) || (node.type === 'harvest' && !!node.harvest_id))
  const cls = [
    styles.node,
    styles[`type_${node.type}`],
    node.role === 'focus' ? styles.focus : '',
    node.role === 'related' ? styles.related : '',
    clickable ? styles.clickable : '',
  ].join(' ')

  function onKey(e: KeyboardEvent) {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onOpen()
    }
  }

  return (
    <g
      transform={`translate(${x(placed)},${y(placed)})`}
      className={cls}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={onKey}
      role={clickable ? 'link' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={`${node.title}, ${node.subtitle}`}
    >
      <title>
        {[node.title, node.subtitle, detail(node), node.occurred_at ? shortDate(node.occurred_at) : '']
          .filter(Boolean)
          .join('\n')}
      </title>
      <rect width={NODE_W} height={NODE_H} rx={10} className={styles.box} />
      <rect width={4} height={NODE_H - 16} x={0} y={8} rx={2} className={styles.typeBar} />
      <text x={14} y={22} className={node.type === 'lot' ? styles.codeText : styles.titleText}>
        {clip(node.title, 20)}
      </text>
      <text x={14} y={41} className={styles.subText}>
        {clip(node.subtitle, 24)}
      </text>
      <text x={14} y={58} className={styles.metaText}>
        {clip(detail(node), 23)}
      </text>
    </g>
  )
}

/** The third line: what's most useful at a glance for each kind of box. */
function detail(node: TraceNode): string {
  if (node.type === 'lot') {
    const share =
      node.harvest_share != null ? `${Math.round(Number(node.harvest_share) * 100)}% · ` : ''
    if (node.status === 'ended') return `${share}Used up`
    if (node.lot_kind !== 'tank' && node.unit_count != null && node.unit_volume_l) {
      const where = node.status === 'dispatched' ? 'ready for sale' : 'packaged'
      return `${share}${node.unit_count} × ${trim(node.unit_volume_l)} L · ${where}`
    }
    if (node.status === 'dispatched') return `${share}Ready for sale`
    const volume = node.volume_l ? `${trim(node.volume_l)} L` : ''
    return share + [node.vessel_code, volume].filter(Boolean).join(' · ')
  }
  if (node.type === 'harvest' && node.reference) return node.reference
  return node.occurred_at ? shortDate(node.occurred_at) : ''
}

function Legend({ subject }: { subject: TraceGraph['subject_type'] }) {
  return (
    <div className={styles.legend}>
      <span>
        <i className={`${styles.swatch} ${styles.swatchFocus}`} />
        This {subject}
      </span>
      <span>
        <i className={styles.swatch} />
        Its line
      </span>
      {subject === 'lot' ? (
        <span>
          <i className={`${styles.swatch} ${styles.swatchRelated}`} />
          Shares its fruit
        </span>
      ) : (
        <span>% = how much of each lot came from this harvest</span>
      )}
    </div>
  )
}

/** "100.00" → "100", "0.750" → "0.75". */
function trim(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
