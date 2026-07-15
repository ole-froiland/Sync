import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '@/types'
import { buildTreeLayout, visibleSubtreeBounds } from './buildTreeLayout'
import { COL_H, NODE_W, NODE_H, H_GAP, ROW_V, ROOT_ID } from './constants'
import { readableTreeLabel } from './TreeNode'

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
    expect(nodes[0].y).toBe(NODE_H / 2)
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
    expect(a.y).toBe(ROW_V + NODE_H / 2)
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
    expect(a1.y).toBe(ROW_V * 2 + NODE_H / 2)
  })

  it('lays depth along the x-axis in horizontal orientation', () => {
    const { nodes } = buildTreeLayout([folder('a'), folder('a1', 'a')], {
      collapsed: new Set<string>(),
      currentId: null,
      orientation: 'horizontal',
    })
    const root = nodes.find((n) => n.id === ROOT_ID)!
    const a = nodes.find((n) => n.id === 'a')!
    const a1 = nodes.find((n) => n.id === 'a1')!
    expect(root.x).toBe(NODE_W / 2)
    expect(a.x).toBe(COL_H + NODE_W / 2)
    expect(a1.x).toBe(COL_H * 2 + NODE_W / 2)
    // single chain stays aligned on the sibling (y) axis
    expect(a.y).toBe(root.y)
    expect(a1.y).toBe(a.y)
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

  it('uses the repository portion of a GitHub name for a compact node label', () => {
    expect(readableTreeLabel('ole-froiland/sync-app', 'github')).toBe('sync-app')
    expect(readableTreeLabel('Prosjektmappe', 'folder')).toBe('Prosjektmappe')
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

describe('visibleSubtreeBounds', () => {
  it('covers the selected folder and all visible descendants but not its siblings', () => {
    const { nodes } = buildTreeLayout(
      [folder('selected'), folder('child-a', 'selected'), folder('child-b', 'selected'), folder('sibling')],
      opts()
    )
    const bounds = visibleSubtreeBounds(nodes, 'selected')!
    const subtreeNodes = nodes.filter((node) => ['selected', 'child-a', 'child-b'].includes(node.id))
    const sibling = nodes.find((node) => node.id === 'sibling')!

    expect(bounds.left).toBe(Math.min(...subtreeNodes.map((node) => node.x - NODE_W / 2)))
    expect(bounds.right).toBe(Math.max(...subtreeNodes.map((node) => node.x + NODE_W / 2)))
    expect(bounds.right).toBeLessThan(sibling.x - NODE_W / 2)
  })

  it('returns only the selected box when its descendants are collapsed', () => {
    const { nodes } = buildTreeLayout(
      [folder('selected'), folder('child', 'selected')],
      opts({ collapsed: new Set(['selected']) })
    )
    const selected = nodes.find((node) => node.id === 'selected')!

    expect(visibleSubtreeBounds(nodes, 'selected')).toEqual({
      left: selected.x - NODE_W / 2,
      top: selected.y - NODE_H / 2,
      right: selected.x + NODE_W / 2,
      bottom: selected.y + NODE_H / 2,
    })
  })
})
