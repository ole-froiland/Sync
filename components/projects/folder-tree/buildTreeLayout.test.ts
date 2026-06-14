import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '@/types'
import { buildTreeLayout } from './buildTreeLayout'
import { NODE_W, NODE_H, H_GAP, ROW_V, ROOT_ID } from './constants'

function folder(id: string, parentId?: string, items: ProjectFolder['items'] = []): ProjectFolder {
  return { id, name: id, description: '', color: 'bg-fuchsia-600', parentId, createdAt: '2026-01-01', items }
}
const opts = (over: Partial<{ collapsed: Set<string>; currentId: string | null }> = {}) => ({
  collapsed: over.collapsed ?? new Set<string>(),
  currentId: over.currentId ?? null,
})

describe('buildTreeLayout', () => {
  it('returns only the synthetic root for no folders', () => {
    const { nodes, edges } = buildTreeLayout([], opts())
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(ROOT_ID)
    expect(nodes[0].kind).toBe('root')
    expect(nodes[0].x).toBe(NODE_W / 2)
    expect(nodes[0].y).toBe(0)
    expect(edges).toHaveLength(0)
  })

  it('places two top-level folders side by side and centers the root', () => {
    const { nodes, edges } = buildTreeLayout([folder('a'), folder('b')], opts())
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    const root = nodes.find((n) => n.id === ROOT_ID)!
    expect(a.x).toBe(NODE_W / 2) // 86
    expect(b.x).toBe(NODE_W + H_GAP + NODE_W / 2) // 286
    expect(root.x).toBe((a.x + b.x) / 2) // 186
    expect(a.y).toBe(ROW_V)
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parentId: ROOT_ID, childId: 'a' }),
        expect.objectContaining({ parentId: ROOT_ID, childId: 'b' }),
      ])
    )
  })

  it('nests subfolders one row deeper', () => {
    const { nodes } = buildTreeLayout([folder('a'), folder('a1', 'a')], opts())
    const a1 = nodes.find((n) => n.id === 'a1')!
    expect(a1.parentId).toBe('a')
    expect(a1.y).toBe(ROW_V * 2)
  })

  it('hides children of a collapsed folder but marks it expandable', () => {
    const { nodes } = buildTreeLayout([folder('a'), folder('a1', 'a')], opts({ collapsed: new Set(['a']) }))
    expect(nodes.find((n) => n.id === 'a1')).toBeUndefined()
    const a = nodes.find((n) => n.id === 'a')!
    expect(a.hasChildren).toBe(true)
    expect(a.childCount).toBe(1)
    expect(a.expanded).toBe(false)
  })

  it('adds folder items as leaf nodes after subfolders', () => {
    const a = folder('a', undefined, [
      { id: 'i1', type: 'github', title: 'sync-app', body: '', createdAt: '2026-01-01' },
    ])
    const { nodes } = buildTreeLayout([a, folder('a-sub', 'a')], opts())
    const item = nodes.find((n) => n.id === 'i1')!
    expect(item.kind).toBe('item')
    expect(item.itemType).toBe('github')
    expect(item.parentId).toBe('a')
    expect(item.hasChildren).toBe(false)
  })

  it('marks the active path from root to currentId', () => {
    const { nodes, edges } = buildTreeLayout(
      [folder('a'), folder('a1', 'a'), folder('b')],
      opts({ currentId: 'a' })
    )
    expect(nodes.find((n) => n.id === 'a')!.isCurrent).toBe(true)
    expect(nodes.find((n) => n.id === 'a')!.onPath).toBe(true)
    expect(nodes.find((n) => n.id === ROOT_ID)!.onPath).toBe(true)
    expect(nodes.find((n) => n.id === 'b')!.onPath).toBe(false)
    expect(nodes.find((n) => n.id === 'a1')!.onPath).toBe(false)
    expect(edges.find((e) => e.childId === 'a')!.onPath).toBe(true)
    expect(edges.find((e) => e.childId === 'b')!.onPath).toBe(false)
  })

  it('reports overall width/height covering all nodes', () => {
    const { width, height } = buildTreeLayout([folder('a'), folder('b')], opts())
    expect(width).toBe(NODE_W + H_GAP + NODE_W) // 372
    expect(height).toBe(ROW_V + NODE_H) // deepest row top + node height
  })
})
