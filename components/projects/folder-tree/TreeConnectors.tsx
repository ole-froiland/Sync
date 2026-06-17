import type { TreeEdge, TreeNodeModel, TreeOrientation } from './buildTreeLayout'
import { NODE_H, NODE_W } from './constants'

interface Props {
  nodes: TreeNodeModel[]
  edges: TreeEdge[]
  width: number
  height: number
  orientation: TreeOrientation
}

/** Dimmed structural line. Semi-transparent, but all dim edges share ONE path
 *  element so overlapping trunks are painted once (no alpha build-up). */
const DIM_STROKE = 'rgba(255,255,255,0.13)'
/** Active path. Opaque (the 0.6 violet pre-blended on the dark canvas) so it
 *  stays crisp and uniform wherever it overlaps the dim layer. */
const ACTIVE_STROKE = '#68589c'

export default function TreeConnectors({ nodes, edges, width, height, orientation }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const dimParts: string[] = []
  const activeParts: string[] = []
  const horizontal = orientation === 'horizontal'

  for (const edge of edges) {
    const p = byId.get(edge.parentId)
    const c = byId.get(edge.childId)
    if (!p || !c) continue
    let d: string
    if (horizontal) {
      const px = p.x + NODE_W / 2 // parent right edge
      const cx = c.x - NODE_W / 2 // child left edge
      const midX = px + (cx - px) / 2
      d = `M ${px} ${p.y} H ${midX} V ${c.y} H ${cx}`
    } else {
      const py = p.y + NODE_H / 2 // parent bottom edge
      const cy = c.y - NODE_H / 2 // child top edge
      const midY = py + (cy - py) / 2
      d = `M ${p.x} ${py} V ${midY} H ${c.x} V ${cy}`
    }
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
