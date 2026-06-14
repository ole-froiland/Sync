import type { TreeEdge, TreeNodeModel } from './buildTreeLayout'
import { NODE_H } from './constants'

interface Props {
  nodes: TreeNodeModel[]
  edges: TreeEdge[]
  width: number
  height: number
}

export default function TreeConnectors({ nodes, edges, width, height }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      {edges.map((edge) => {
        const p = byId.get(edge.parentId)
        const c = byId.get(edge.childId)
        if (!p || !c) return null
        const py = p.y + NODE_H
        const cy = c.y
        const midY = py + (cy - py) / 2
        const d = `M ${p.x} ${py} V ${midY} H ${c.x} V ${cy}`
        return (
          <path
            key={`${edge.parentId}-${edge.childId}`}
            d={d}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke={edge.onPath ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.13)'}
          />
        )
      })}
    </svg>
  )
}
