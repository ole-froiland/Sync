import type { ProjectFolder, ProjectItem } from '@/types'
import { H_GAP, NODE_H, NODE_W, ROOT_ID, ROOT_LABEL, ROW_V } from './constants'

export type TreeNodeKind = 'root' | 'folder' | 'item'

export interface TreeNodeModel {
  id: string
  kind: TreeNodeKind
  label: string
  itemType?: ProjectItem['type']
  parentId: string | null
  depth: number
  x: number // center x
  y: number // top y
  hasChildren: boolean
  childCount: number
  expanded: boolean
  isCurrent: boolean
  onPath: boolean
}

export interface TreeEdge {
  parentId: string
  childId: string
  onPath: boolean
}

export interface TreeLayout {
  nodes: TreeNodeModel[]
  edges: TreeEdge[]
  width: number
  height: number
}

export interface BuildOpts {
  collapsed: ReadonlySet<string>
  currentId: string | null
}

interface WorkNode {
  model: TreeNodeModel
  children: WorkNode[]
}

export function buildTreeLayout(folders: ProjectFolder[], opts: BuildOpts): TreeLayout {
  const { collapsed, currentId } = opts
  const childFolders = new Map<string | null, ProjectFolder[]>()
  const folderById = new Map<string, ProjectFolder>()
  for (const f of folders) {
    folderById.set(f.id, f)
    const key = f.parentId ?? null
    const list = childFolders.get(key) ?? []
    list.push(f)
    childFolders.set(key, list)
  }

  // active path = root + ancestors of currentId (inclusive)
  const activePath = new Set<string>([ROOT_ID])
  let cur: string | null = currentId
  while (cur) {
    activePath.add(cur)
    cur = folderById.get(cur)?.parentId ?? null
  }

  function makeFolderNode(folder: ProjectFolder, depth: number): WorkNode {
    const subfolders = childFolders.get(folder.id) ?? []
    const items = folder.items ?? []
    const expanded = !collapsed.has(folder.id)
    const children: WorkNode[] = []
    if (expanded) {
      for (const sub of subfolders) children.push(makeFolderNode(sub, depth + 1))
      for (const item of items) children.push(makeItemNode(item, folder.id, depth + 1))
    }
    return {
      model: {
        id: folder.id,
        kind: 'folder',
        label: folder.name,
        parentId: folder.parentId ?? ROOT_ID,
        depth,
        x: 0,
        y: depth * ROW_V,
        hasChildren: subfolders.length + items.length > 0,
        childCount: subfolders.length + items.length,
        expanded,
        isCurrent: folder.id === currentId,
        onPath: activePath.has(folder.id),
      },
      children,
    }
  }

  function makeItemNode(item: ProjectItem, parentId: string, depth: number): WorkNode {
    return {
      model: {
        id: item.id,
        kind: 'item',
        label: item.title,
        itemType: item.type,
        parentId,
        depth,
        x: 0,
        y: depth * ROW_V,
        hasChildren: false,
        childCount: 0,
        expanded: false,
        isCurrent: false,
        onPath: false,
      },
      children: [],
    }
  }

  const topLevel = childFolders.get(null) ?? []
  const root: WorkNode = {
    model: {
      id: ROOT_ID,
      kind: 'root',
      label: ROOT_LABEL,
      parentId: null,
      depth: 0,
      x: 0,
      y: 0,
      hasChildren: topLevel.length > 0,
      childCount: topLevel.length,
      expanded: true,
      isCurrent: false,
      onPath: true,
    },
    children: topLevel.map((f) => makeFolderNode(f, 1)),
  }

  // assign center x via post-order leaf packing
  let cursor = 0
  function place(node: WorkNode): void {
    if (node.children.length === 0) {
      node.model.x = cursor + NODE_W / 2
      cursor += NODE_W + H_GAP
      return
    }
    node.children.forEach(place)
    const first = node.children[0].model.x
    const last = node.children[node.children.length - 1].model.x
    node.model.x = (first + last) / 2
  }
  place(root)

  // flatten + edges
  const nodes: TreeNodeModel[] = []
  const edges: TreeEdge[] = []
  function flatten(node: WorkNode): void {
    nodes.push(node.model)
    for (const child of node.children) {
      edges.push({
        parentId: node.model.id,
        childId: child.model.id,
        onPath: activePath.has(node.model.id) && activePath.has(child.model.id),
      })
      flatten(child)
    }
  }
  flatten(root)

  const width = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W / 2), 0)
  const height = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 0)
  return { nodes, edges, width, height }
}
