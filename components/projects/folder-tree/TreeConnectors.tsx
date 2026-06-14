import type { TreeEdge, TreeNodeModel } from './buildTreeLayout'
import { NODE_H } from './constants'

interface Props {
  nodes: TreeNodeModel[]
  edges: TreeEdge[]
  width: number
  height: number
}

/** Dimmed structural line. Semi-transparent, but all dim edges share ONE path
 *  element so overlapping trunks are painted once (no alpha build-up). */
const DIM_STROKE = 'rgba(255,255,255,0.13)'
/** Active path. Opaque (the 0.6 violet pre-blended on the dark canvas) so it
 *  stays crisp and uniform wherever it overlaps the dim layer. */
const ACTIVE_STROKE = '#68589c'

export default function TreeConnectors({ nodes, edges, width, height }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const dimParts: string[] = []
  const activeParts: string[] = []

  for (const edge of edges) {
    const p = byId.get(edge.parentId)
    const c = byId.get(edge.childId)
    if (!p || !c) continue
    const py = p.y + NODE_H
    const midY = py + (c.y - py) / 2
    const d = `M ${p.x} ${py} V ${midY} H ${c.x} V ${c.y}`
    ;(edge.onPath ? activeParts : dimParts).push(d)
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      {dimParts.length > 0 && (
        <path
          d={dimParts.join(' ')}
          fill="none"
          stroke={DIM_STROKE}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {activeParts.length > 0 && (
        <path
          d={activeParts.join(' ')}
          fill="none"
          stroke={ACTIVE_STROKE}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
