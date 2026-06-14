# Interaktiv trevisning for prosjektmapper — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark, minimalist, interactive org-tree overlay that visualizes the existing project-folder structure, with pan/zoom, expand/collapse, and per-folder actions (open / add / rename / delete) — without replacing the existing grid/preview views.

**Architecture:** One self-contained module `components/projects/folder-tree/` (pure layout function + pan/zoom math + presentational components + overlay shell). The overlay is presentation over the existing `folders` array; all mutations go through the projects page via callbacks, so localStorage + Supabase sync stay unchanged. Folder/item types are lifted to `@/types` so both the page and the module share them.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, TypeScript, Tailwind 4, `framer-motion` (already installed), `lucide-react`, vitest (pure-logic tests only — no React test runner in this repo).

**Design reference:** `docs/superpowers/specs/2026-06-14-folder-tree-view-design.md`

**Conventions:**
- Run a single test file with: `npx vitest run <path>`.
- This repo only unit-tests pure logic (`lib/uuid.test.ts`, `lib/calendar/calendar-filter.ts`). Do **not** add `@testing-library/react`/jsdom. Presentational components are verified manually in the final task.
- Per `AGENTS.md` ("This is NOT the Next.js you know"): before the page-integration task, skim `node_modules/next/dist/docs/` for any client-component/portal notes. The overlay is a `'use client'` component using `react-dom` `createPortal` + React state only — no Next-specific server APIs.
- Layout constants are shared; never hard-code them twice.

---

## File Structure

| File | Responsibility |
|---|---|
| `types/index.ts` (modify) | Add shared `ProjectLogo`, `ProjectFolderMember`, `ProjectItem`, `ProjectFolder` types |
| `app/(app)/projects/page.tsx` (modify) | Import shared types; add explicit-target handlers; add `initialMode` to `CreateItemModal`; add "Vis som tre" button, `treeOpen` state, overlay render + targeted modals |
| `components/projects/folder-tree/constants.ts` (create) | Layout constants + `ROOT_ID` + `AddKind` |
| `components/projects/folder-tree/buildTreeLayout.ts` (create) | Pure layout: `(folders, opts) → { nodes, edges, width, height }` |
| `components/projects/folder-tree/buildTreeLayout.test.ts` (create) | Unit tests for the layout |
| `components/projects/folder-tree/panzoom-math.ts` (create) | Pure pan/zoom helpers (`zoomAt`, `computeFit`, `clampScale`) |
| `components/projects/folder-tree/panzoom-math.test.ts` (create) | Unit tests for pan/zoom math |
| `components/projects/folder-tree/usePanZoom.ts` (create) | Hook wrapping the math + pointer/wheel handlers |
| `components/projects/folder-tree/TreeConnectors.tsx` (create) | SVG layer drawing precise elbow links |
| `components/projects/folder-tree/TreeNode.tsx` (create) | One node box (folder/item/root): centered icon+label, hover toolbar, expand control, inline rename |
| `components/projects/folder-tree/CreateMenu.tsx` (create) | The "+" type menu, emits `AddKind` |
| `components/projects/folder-tree/TreeControls.tsx` (create) | Zoom −/%/＋ + "Tilbakestill visning" |
| `components/projects/folder-tree/FolderTreeOverlay.tsx` (create) | Compose everything; owns collapsed-set + rename + pan/zoom; portal + framer-motion |
| `components/projects/folder-tree/index.ts` (create) | Re-export `FolderTreeOverlay` |

---

## Task 1: Lift shared folder types into `@/types`

**Files:**
- Modify: `types/index.ts`
- Modify: `app/(app)/projects/page.tsx` (remove local decls, import instead)

- [ ] **Step 1: Add the types to `types/index.ts`**

Append to `types/index.ts`:

```ts
export type ProjectLogo = {
  type: 'icon' | 'emoji' | 'image'
  value: string
}

export type ProjectFolderMember = {
  id: string
  name: string
  avatar_url: string | null
  role?: 'creator' | 'member'
}

export type ProjectItem = {
  id: string
  type:
    | 'note'
    | 'link'
    | 'file'
    | 'task'
    | 'docs'
    | 'sheets'
    | 'word'
    | 'excel'
    | 'folder'
    | 'github'
    | 'local_folder'
    | 'notion'
    | 'url'
    | 'document'
  title: string
  body: string
  url?: string
  path?: string
  fileName?: string
  fileSize?: number
  parentId?: string
  done?: boolean
  status?: string
  createdAt: string
  updatedAt?: string
}

export type ProjectFolder = {
  id: string
  name: string
  description: string
  color: string
  logo?: ProjectLogo
  parentId?: string
  createdAt: string
  members?: ProjectFolderMember[]
  sharedFrom?: ProjectFolderMember
  items: ProjectItem[]
}
```

- [ ] **Step 2: Import them in `page.tsx` and delete the local declarations**

In `app/(app)/projects/page.tsx`, extend the existing types import:

```ts
import type { GitHubUserRepo, Profile, ProjectFolder, ProjectFolderMember, ProjectItem, ProjectLogo } from '@/types'
```

Then **delete** the local `type ProjectFolder`, `type ProjectFolderMember`, `type ProjectLogo`, and `type ProjectItem` declarations (the blocks currently near the top of the file). Leave the other local types (`ItemType`, `ResourceMode`, etc.) as-is — `ItemType = ProjectItem['type']` keeps working against the imported type.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to `ProjectFolder`/`ProjectItem` (pre-existing unrelated errors, if any, are out of scope — confirm none are new).

- [ ] **Step 4: Commit**

```bash
git add types/index.ts "app/(app)/projects/page.tsx"
git commit -m "refactor: lift project folder/item types into @/types"
```

---

## Task 2: Layout constants + shared module types

**Files:**
- Create: `components/projects/folder-tree/constants.ts`

- [ ] **Step 1: Create the constants file**

```ts
// components/projects/folder-tree/constants.ts

/** Uniform node box width in px (locked design). */
export const NODE_W = 172
/** Uniform node box height in px. */
export const NODE_H = 42
/** Horizontal gap between sibling boxes. */
export const H_GAP = 28
/** Vertical pitch between row tops (node height + connector gap). */
export const ROW_V = 132
/** Id of the synthetic root node ("Prosjekter"). */
export const ROOT_ID = '__tree_root__'
/** Label of the synthetic root node. */
export const ROOT_LABEL = 'Prosjekter'

/** What the "+" menu can create. Maps to the existing add-flow in the page. */
export type AddKind = 'subfolder' | 'repo' | 'link' | 'app' | 'file'
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/folder-tree/constants.ts
git commit -m "feat: folder-tree layout constants"
```

---

## Task 3: Pure layout function `buildTreeLayout` (TDD)

**Files:**
- Create: `components/projects/folder-tree/buildTreeLayout.ts`
- Test: `components/projects/folder-tree/buildTreeLayout.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// components/projects/folder-tree/buildTreeLayout.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/projects/folder-tree/buildTreeLayout.test.ts`
Expected: FAIL — "Cannot find module './buildTreeLayout'".

- [ ] **Step 3: Implement `buildTreeLayout`**

```ts
// components/projects/folder-tree/buildTreeLayout.ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/projects/folder-tree/buildTreeLayout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add components/projects/folder-tree/buildTreeLayout.ts components/projects/folder-tree/buildTreeLayout.test.ts
git commit -m "feat: buildTreeLayout pure tidy-tree layout"
```

---

## Task 4: Pan/zoom math (TDD)

**Files:**
- Create: `components/projects/folder-tree/panzoom-math.ts`
- Test: `components/projects/folder-tree/panzoom-math.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// components/projects/folder-tree/panzoom-math.test.ts
import { describe, expect, it } from 'vitest'
import { clampScale, computeFit, zoomAt } from './panzoom-math'

describe('clampScale', () => {
  it('clamps to [0.3, 2]', () => {
    expect(clampScale(0.1)).toBe(0.3)
    expect(clampScale(5)).toBe(2)
    expect(clampScale(1)).toBe(1)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const start = { scale: 1, tx: 0, ty: 0 }
    const cx = 200
    const cy = 100
    // world point currently under cursor
    const worldX = (cx - start.tx) / start.scale
    const next = zoomAt(start, 1.2, cx, cy)
    // same world point must still map to the cursor screen position
    expect(next.tx + worldX * next.scale).toBeCloseTo(cx, 5)
    expect(next.scale).toBeCloseTo(1.2, 5)
  })
})

describe('computeFit', () => {
  it('centers content and never scales above 1', () => {
    const t = computeFit(200, 100, 1000, 600, 0)
    expect(t.scale).toBe(1)
    expect(t.tx).toBeCloseTo((1000 - 200) / 2, 5)
    expect(t.ty).toBeCloseTo((600 - 100) / 2, 5)
  })

  it('scales down to fit oversized content', () => {
    const t = computeFit(2000, 100, 1000, 600, 0)
    expect(t.scale).toBeCloseTo(0.5, 5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/projects/folder-tree/panzoom-math.test.ts`
Expected: FAIL — "Cannot find module './panzoom-math'".

- [ ] **Step 3: Implement the math**

```ts
// components/projects/folder-tree/panzoom-math.ts
export interface ViewTransform {
  scale: number
  tx: number
  ty: number
}

export const MIN_SCALE = 0.3
export const MAX_SCALE = 2

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** Zoom by `factor` while keeping the screen point (cx, cy) fixed. */
export function zoomAt(t: ViewTransform, factor: number, cx: number, cy: number): ViewTransform {
  const scale = clampScale(t.scale * factor)
  const k = scale / t.scale
  return {
    scale,
    tx: cx - (cx - t.tx) * k,
    ty: cy - (cy - t.ty) * k,
  }
}

/** Center `contentW x contentH` inside `viewW x viewH`, scaled to fit (never > 1). */
export function computeFit(
  contentW: number,
  contentH: number,
  viewW: number,
  viewH: number,
  padding = 48
): ViewTransform {
  const usableW = Math.max(1, viewW - padding * 2)
  const usableH = Math.max(1, viewH - padding * 2)
  const scale = clampScale(Math.min(usableW / contentW, usableH / contentH, 1))
  return {
    scale,
    tx: (viewW - contentW * scale) / 2,
    ty: (viewH - contentH * scale) / 2,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/projects/folder-tree/panzoom-math.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/projects/folder-tree/panzoom-math.ts components/projects/folder-tree/panzoom-math.test.ts
git commit -m "feat: pan/zoom math helpers"
```

---

## Task 5: `usePanZoom` hook

**Files:**
- Create: `components/projects/folder-tree/usePanZoom.ts`

- [ ] **Step 1: Implement the hook**

```ts
// components/projects/folder-tree/usePanZoom.ts
'use client'

import { useCallback, useRef, useState } from 'react'
import { clampScale, computeFit, zoomAt, type ViewTransform } from './panzoom-math'

const ZOOM_STEP = 1.2

export function usePanZoom() {
  const [t, setT] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // only start panning on background (not when a node handled it)
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty }
  }, [t.tx, t.ty])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    setT((prev) => ({
      ...prev,
      tx: drag.current!.tx + (e.clientX - drag.current!.x),
      ty: drag.current!.ty + (e.clientY - drag.current!.y),
    }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // capture may already be released
    }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    setT((prev) => zoomAt(prev, factor, cx, cy))
  }, [])

  const zoomIn = useCallback((cx: number, cy: number) => setT((p) => zoomAt(p, ZOOM_STEP, cx, cy)), [])
  const zoomOut = useCallback((cx: number, cy: number) => setT((p) => zoomAt(p, 1 / ZOOM_STEP, cx, cy)), [])
  const setScaleAbsolute = useCallback((scale: number) => setT((p) => ({ ...p, scale: clampScale(scale) })), [])

  const fit = useCallback((contentW: number, contentH: number, viewW: number, viewH: number) => {
    setT(computeFit(contentW, contentH, viewW, viewH))
  }, [])

  return {
    transform: t,
    bind: { onPointerDown, onPointerMove, onPointerUp, onWheel },
    zoomIn,
    zoomOut,
    setScaleAbsolute,
    fit,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/projects/folder-tree/usePanZoom.ts
git commit -m "feat: usePanZoom hook"
```

---

## Task 6: `TreeConnectors` (SVG link layer)

**Files:**
- Create: `components/projects/folder-tree/TreeConnectors.tsx`

- [ ] **Step 1: Implement the connectors**

Draws one precise elbow per edge: parent bottom-center → mid-row bus → child top-center.

```tsx
// components/projects/folder-tree/TreeConnectors.tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/projects/folder-tree/TreeConnectors.tsx
git commit -m "feat: TreeConnectors SVG link layer"
```

---

## Task 7: `CreateMenu` (the "+" type menu)

**Files:**
- Create: `components/projects/folder-tree/CreateMenu.tsx`

- [ ] **Step 1: Implement the menu**

```tsx
// components/projects/folder-tree/CreateMenu.tsx
'use client'

import { Folder, Github, Link2, PanelsTopLeft, Upload } from 'lucide-react'
import type { AddKind } from './constants'

interface Props {
  folderLabel: string
  onPick: (kind: AddKind) => void
}

const ITEMS: Array<{ kind: AddKind; label: string; icon: React.ElementType; accent?: boolean }> = [
  { kind: 'subfolder', label: 'Undermappe', icon: Folder, accent: true },
  { kind: 'repo', label: 'Repo', icon: Github },
  { kind: 'link', label: 'Lenke / URL', icon: Link2 },
  { kind: 'app', label: 'Dokument (Docs/Sheets/Notion…)', icon: PanelsTopLeft },
  { kind: 'file', label: 'Last opp fil', icon: Upload },
]

export default function CreateMenu({ folderLabel, onPick }: Props) {
  return (
    <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#13151b] pb-1 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)]">
      <div className="border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Legg til i {folderLabel}
      </div>
      {ITEMS.map(({ kind, label, icon: Icon, accent }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onPick(kind)}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-gray-300 transition hover:bg-white/5"
        >
          <Icon size={16} className={accent ? 'text-violet-300' : 'text-gray-400'} />
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/projects/folder-tree/CreateMenu.tsx
git commit -m "feat: folder-tree CreateMenu"
```

---

## Task 8: `TreeControls` (zoom + reset)

**Files:**
- Create: `components/projects/folder-tree/TreeControls.tsx`

- [ ] **Step 1: Implement the controls**

```tsx
// components/projects/folder-tree/TreeControls.tsx
'use client'

import { Frame, Minus, Plus } from 'lucide-react'

interface Props {
  scalePercent: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export default function TreeControls({ scalePercent, onZoomIn, onZoomOut, onReset }: Props) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#0f1115] p-1">
        <button type="button" onClick={onZoomOut} aria-label="Zoom ut" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-white/5 hover:text-gray-100">
          <Minus size={15} />
        </button>
        <span className="min-w-[34px] text-center text-[11px] font-semibold text-gray-400">{scalePercent}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom inn" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-white/5 hover:text-gray-100">
          <Plus size={15} />
        </button>
      </div>
      <button type="button" onClick={onReset} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#0f1115] px-3 text-[12px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
        <Frame size={15} />
        Tilbakestill visning
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no new errors)

```bash
git add components/projects/folder-tree/TreeControls.tsx
git commit -m "feat: folder-tree TreeControls"
```

---

## Task 9: `TreeNode` (one box)

**Files:**
- Create: `components/projects/folder-tree/TreeNode.tsx`

- [ ] **Step 1: Implement the node**

Centered icon + label; folder vs item icon; current = lilla ring; ancestor = subtle accent. Folders get a hover toolbar (Åpne · ＋ · rename · slett) and an expand/collapse control under the box (count shown only when collapsed). Inline rename input. Right-click also opens the toolbar (we keep it always-rendered but visible on hover/focus for simplicity; right-click prevents the browser menu and focuses).

```tsx
// components/projects/folder-tree/TreeNode.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Folder,
  FolderOpen,
  Github,
  Link2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  FileText,
  FileSpreadsheet,
  CheckSquare,
  PanelsTopLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem } from '@/types'
import { NODE_H, NODE_W } from './constants'
import type { TreeNodeModel } from './buildTreeLayout'

const ITEM_ICONS: Record<ProjectItem['type'], React.ElementType> = {
  note: StickyNote,
  link: Link2,
  url: Link2,
  file: Upload,
  document: Upload,
  task: CheckSquare,
  github: Github,
  local_folder: Folder,
  folder: Folder,
  notion: PanelsTopLeft,
  docs: FileText,
  word: FileText,
  sheets: FileSpreadsheet,
  excel: FileSpreadsheet,
}

interface Props {
  node: TreeNodeModel
  renaming: boolean
  onToggle: (id: string) => void
  onOpen: (node: TreeNodeModel) => void
  onAdd: (id: string) => void
  onStartRename: (id: string) => void
  onSubmitRename: (id: string, name: string) => void
  onCancelRename: () => void
  onDelete: (id: string) => void
}

export default function TreeNode({
  node,
  renaming,
  onToggle,
  onOpen,
  onAdd,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
}: Props) {
  const isItem = node.kind === 'item'
  const Icon = isItem && node.itemType ? ITEM_ICONS[node.itemType] : node.onPath ? FolderOpen : Folder
  const [draft, setDraft] = useState(node.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setDraft(node.label)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming, node.label])

  return (
    <div
      className="group absolute"
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H, transform: 'translateX(-50%)' }}
    >
      {/* hover toolbar (folders only) */}
      {!isItem && !renaming && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2.5 hidden -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-white/10 bg-[#15171d] p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] group-hover:flex group-focus-within:flex">
          <ToolbarBtn label="Åpne" onClick={() => onOpen(node)}><FolderOpen size={15} /></ToolbarBtn>
          <ToolbarBtn label="Legg til" accent onClick={() => onAdd(node.id)}><Plus size={15} /></ToolbarBtn>
          <ToolbarBtn label="Gi nytt navn" onClick={() => onStartRename(node.id)}><Pencil size={15} /></ToolbarBtn>
          <ToolbarBtn label="Slett" danger onClick={() => onDelete(node.id)}><Trash2 size={15} /></ToolbarBtn>
        </div>
      )}

      {/* the box */}
      <button
        type="button"
        onClick={() => (isItem ? onOpen(node) : node.hasChildren ? onToggle(node.id) : onOpen(node))}
        onContextMenu={(e) => { if (!isItem) { e.preventDefault(); (e.currentTarget as HTMLElement).focus() } }}
        title={node.label}
        className={cn(
          'flex h-full w-full items-center justify-center gap-2 rounded-[11px] border px-3.5 text-[13px] font-medium transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
          node.isCurrent
            ? 'border-violet-400/70 bg-[#14121b] text-violet-100'
            : node.onPath
            ? 'border-violet-400/30 bg-[#0f1115] text-gray-200'
            : 'border-white/[0.07] bg-[#0f1115] text-gray-400 hover:border-white/15'
        )}
      >
        <Icon size={16} className={cn('shrink-0', node.isCurrent ? 'text-violet-300' : node.onPath ? 'text-violet-400/80' : isItem ? 'text-gray-400' : 'text-gray-300')} />
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitRename(node.id, draft.trim() || node.label)
              if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={() => onSubmitRename(node.id, draft.trim() || node.label)}
            className="min-w-0 flex-1 bg-transparent text-center text-gray-100 outline-none"
          />
        ) : (
          <span className="min-w-0 truncate">{node.label}</span>
        )}
      </button>

      {/* expand/collapse control */}
      {!isItem && node.hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          aria-label={node.expanded ? 'Skjul undermapper' : 'Vis undermapper'}
          className="absolute left-1/2 top-full z-[4] mt-1 flex h-[21px] -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#13151b] px-1.5 text-[11px] font-semibold text-gray-400 transition hover:text-gray-100"
        >
          {node.expanded ? <ChevronUp size={12} /> : (<><span>{node.childCount}</span><ChevronDown size={12} /></>)}
        </button>
      )}
    </div>
  )
}

function ToolbarBtn({ children, label, accent, danger, onClick }: { children: React.ReactNode; label: string; accent?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white/10',
        danger ? 'text-red-400' : accent ? 'text-violet-300' : 'text-gray-400'
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (confirm the `ITEM_ICONS` record covers every `ProjectItem['type']` member).

- [ ] **Step 3: Commit**

```bash
git add components/projects/folder-tree/TreeNode.tsx
git commit -m "feat: folder-tree TreeNode"
```

---

## Task 10: `FolderTreeOverlay` (compose) + module barrel

**Files:**
- Create: `components/projects/folder-tree/FolderTreeOverlay.tsx`
- Create: `components/projects/folder-tree/index.ts`

- [ ] **Step 1: Implement the overlay**

Owns: collapsed set (default = everything except the ancestors of `currentFolderId`), renaming id, the "+" menu target, pan/zoom, and fit-on-open. Renders header (title + breadcrumb + close), the pannable stage (connectors + nodes), controls, and the create menu popover. Portal + framer-motion. Always dark.

```tsx
// components/projects/folder-tree/FolderTreeOverlay.tsx
'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ProjectFolder, ProjectItem } from '@/types'
import type { AddKind } from './constants'
import { ROOT_ID } from './constants'
import { buildTreeLayout, type TreeNodeModel } from './buildTreeLayout'
import { usePanZoom } from './usePanZoom'
import TreeConnectors from './TreeConnectors'
import TreeNode from './TreeNode'
import TreeControls from './TreeControls'
import CreateMenu from './CreateMenu'

interface Props {
  open: boolean
  folders: ProjectFolder[]
  currentFolderId: string | null
  onClose: () => void
  onOpenFolder: (folderId: string) => void
  onRenameFolder: (folderId: string, name: string) => void
  onDeleteFolder: (folderId: string) => void
  onAdd: (folderId: string, kind: AddKind) => void
}

function ancestorsOf(folders: ProjectFolder[], id: string | null): Set<string> {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const set = new Set<string>()
  let cur = id
  while (cur) {
    set.add(cur)
    cur = byId.get(cur)?.parentId ?? null
  }
  return set
}

export default function FolderTreeOverlay({
  open,
  folders,
  currentFolderId,
  onClose,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onAdd,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const { transform, bind, zoomIn, zoomOut, fit } = usePanZoom()

  useEffect(() => setMounted(true), [])

  // initial collapsed set: collapse every folder that is NOT an ancestor of the current folder
  useEffect(() => {
    if (!open) return
    const keepOpen = ancestorsOf(folders, currentFolderId)
    const next = new Set<string>()
    for (const f of folders) if (!keepOpen.has(f.id)) next.add(f.id)
    setCollapsed(next)
    setRenamingId(null)
    setMenuFolderId(null)
  }, [open, currentFolderId, folders])

  const layout = useMemo(() => buildTreeLayout(folders, { collapsed, currentId: currentFolderId }), [folders, collapsed, currentFolderId])

  // fit to view whenever the layout size or open-state changes
  useLayoutEffect(() => {
    if (!open || !viewportRef.current) return
    const { clientWidth, clientHeight } = viewportRef.current
    fit(layout.width, layout.height, clientWidth, clientHeight)
  }, [open, layout.width, layout.height, fit])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openNode(node: TreeNodeModel) {
    if (node.kind === 'item') {
      const item = findItem(folders, node.id)
      if (item?.url) window.open(item.url, '_blank', 'noopener')
      else if (node.parentId && node.parentId !== ROOT_ID) onOpenFolder(node.parentId)
      return
    }
    if (node.id !== ROOT_ID) onOpenFolder(node.id)
  }

  const breadcrumb = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    const names: string[] = []
    let cur = currentFolderId
    while (cur) {
      const f = byId.get(cur)
      if (!f) break
      names.unshift(f.name)
      cur = f.parentId ?? null
    }
    return names
  }, [folders, currentFolderId])

  const menuFolder = menuFolderId ? folders.find((f) => f.id === menuFolderId) : null
  const menuNode = menuFolderId ? layout.nodes.find((n) => n.id === menuFolderId) : null

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[900] flex flex-col bg-[#08090c]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-gray-200">Mappetre</span>
              <span className="text-[12px] font-medium text-gray-500">
                Prosjekter{breadcrumb.map((n) => (<span key={n}><span className="mx-1.5 text-gray-700">/</span><span className="text-gray-300">{n}</span></span>))}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Lukk" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-white/[0.07] bg-[#0f1115] text-gray-400 transition hover:text-gray-100">
              <X size={15} />
            </button>
          </div>

          {/* stage */}
          <div
            ref={viewportRef}
            className="relative flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
            onClick={() => setMenuFolderId(null)}
            {...bind}
            onWheel={bind.onWheel}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`, width: layout.width, height: layout.height }}
            >
              <TreeConnectors nodes={layout.nodes} edges={layout.edges} width={layout.width} height={layout.height} />
              {layout.nodes.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  renaming={renamingId === node.id}
                  onToggle={toggle}
                  onOpen={openNode}
                  onAdd={(id) => setMenuFolderId((cur) => (cur === id ? null : id))}
                  onStartRename={setRenamingId}
                  onSubmitRename={(id, name) => { onRenameFolder(id, name); setRenamingId(null) }}
                  onCancelRename={() => setRenamingId(null)}
                  onDelete={onDeleteFolder}
                />
              ))}

              {/* create menu popover, anchored under the node */}
              {menuFolder && menuNode && (
                <div className="absolute z-20" style={{ left: menuNode.x, top: menuNode.y + 52, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
                  <CreateMenu
                    folderLabel={menuFolder.name}
                    onPick={(kind) => { onAdd(menuFolder.id, kind); setMenuFolderId(null) }}
                  />
                </div>
              )}
            </div>

            <TreeControls
              scalePercent={Math.round(transform.scale * 100)}
              onZoomIn={() => { const r = viewportRef.current!.getBoundingClientRect(); zoomIn(r.width / 2, r.height / 2) }}
              onZoomOut={() => { const r = viewportRef.current!.getBoundingClientRect(); zoomOut(r.width / 2, r.height / 2) }}
              onReset={() => { const r = viewportRef.current!.getBoundingClientRect(); fit(layout.width, layout.height, r.width, r.height) }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function findItem(folders: ProjectFolder[], itemId: string): ProjectItem | undefined {
  for (const f of folders) {
    const found = f.items?.find((i) => i.id === itemId)
    if (found) return found
  }
  return undefined
}
```

- [ ] **Step 2: Create the barrel export**

```ts
// components/projects/folder-tree/index.ts
export { default as FolderTreeOverlay } from './FolderTreeOverlay'
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/projects/folder-tree/FolderTreeOverlay.tsx components/projects/folder-tree/index.ts
git commit -m "feat: FolderTreeOverlay composition"
```

---

## Task 11: Wire the overlay into the projects page

**Files:**
- Modify: `app/(app)/projects/page.tsx`

- [ ] **Step 1: Add `initialMode` support to `CreateItemModal`**

In the `CreateItemModal` definition (around line 3051), add an optional prop and seed the mode from it. Change the signature:

```tsx
function CreateItemModal({
  open,
  onClose,
  onCreate,
  initialMode,
}: {
  open: boolean
  onClose: () => void
  onCreate: (item: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  initialMode?: ResourceMode
}) {
  const [mode, setMode] = useState<ResourceMode>(initialMode ?? 'github')
```

Then, just after the existing repo-fetch `useEffect` (the one keyed on `[open]`), add an effect that applies `initialMode` each time the modal opens:

```tsx
  useEffect(() => {
    if (open && initialMode) setMode(initialMode)
  }, [open, initialMode])
```

- [ ] **Step 2: Add explicit-target handlers + tree state**

Inside `ProjectsPage`, alongside the other handlers (e.g. right after `createFolder`), add:

```tsx
  const [treeOpen, setTreeOpen] = useState(false)
  const [treeSubfolderParentId, setTreeSubfolderParentId] = useState<string | null>(null)
  const [treeItemFolderId, setTreeItemFolderId] = useState<string | null>(null)
  const [treeItemMode, setTreeItemMode] = useState<ResourceMode>('github')

  function addSubfolder(parentId: string, data: Pick<ProjectFolder, 'name' | 'description' | 'color' | 'logo'>) {
    const creator = folderMemberFromProfile(currentProfile)
    const nextFolder: ProjectFolder = {
      ...data,
      id: makeId('folder'),
      parentId,
      createdAt: new Date().toISOString(),
      members: creator ? [creator] : [],
      items: [],
    }
    setFolders((current) => [nextFolder, ...current])
  }

  function addFolderItem(folderId: string, item: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const nextItem: ProjectItem = {
      ...item,
      id: makeId('item'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setFolders((current) =>
      current.map((folder) => (folder.id === folderId ? { ...folder, items: [nextItem, ...folder.items] } : folder))
    )
  }

  function openFolderFromTree(folderId: string) {
    const folder = folders.find((f) => f.id === folderId)
    if (folder) openFolderFromOverview(folder)
    setTreeOpen(false)
  }

  function handleTreeAdd(folderId: string, kind: 'subfolder' | 'repo' | 'link' | 'app' | 'file') {
    if (kind === 'subfolder') {
      setTreeSubfolderParentId(folderId)
      return
    }
    const mode: ResourceMode = kind === 'repo' ? 'github' : kind === 'link' ? 'url' : kind === 'file' ? 'document' : 'app'
    setTreeItemMode(mode)
    setTreeItemFolderId(folderId)
  }
```

- [ ] **Step 3: Import the overlay**

Add near the other component imports at the top of the file:

```tsx
import { FolderTreeOverlay } from '@/components/projects/folder-tree'
import { Workflow } from 'lucide-react'
```

(If `Workflow` is not exported by the installed `lucide-react`, use `Network` instead.)

- [ ] **Step 4: Add the "Vis som tre" button**

In the overview toolbar, immediately after the `Preview` `Button` (the block that toggles `previewMode`), insert:

```tsx
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTreeOpen(true)}
                  className="h-10 whitespace-nowrap"
                >
                  <Workflow size={16} />
                  Vis som tre
                </Button>
```

- [ ] **Step 5: Render the overlay + targeted modals**

In the overview `return (...)`, just before the existing `<CreateFolderModal ... onCreate={createFolder} />` line (around 1480), add:

```tsx
      <FolderTreeOverlay
        open={treeOpen}
        folders={folders}
        currentFolderId={activeParentFolderId}
        onClose={() => setTreeOpen(false)}
        onOpenFolder={openFolderFromTree}
        onRenameFolder={(folderId, name) => updateFolder(folderId, { name })}
        onDeleteFolder={(folderId) => requestDeleteFolder(folderId)}
        onAdd={handleTreeAdd}
      />
      <CreateFolderModal
        open={treeSubfolderParentId !== null}
        onClose={() => setTreeSubfolderParentId(null)}
        onCreate={(data) => {
          if (treeSubfolderParentId) addSubfolder(treeSubfolderParentId, data)
          setTreeSubfolderParentId(null)
        }}
      />
      <CreateItemModal
        open={treeItemFolderId !== null}
        initialMode={treeItemMode}
        onClose={() => setTreeItemFolderId(null)}
        onCreate={(item) => {
          if (treeItemFolderId) addFolderItem(treeItemFolderId, item)
          setTreeItemFolderId(null)
        }}
      />
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (`requestDeleteFolder` opens the existing `DeleteFolderModal`, which renders above the overlay because `Modal` uses `z-[1000]` vs the overlay's `z-[900]`.)

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/projects/page.tsx"
git commit -m "feat: open project folders as an interactive tree view"
```

---

## Task 12: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build to catch any production-only issues**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 2: Run the app and walk the checklist**

Run: `npm run dev`, open the Prosjekter page (create a couple of nested folders + add a repo/doc if empty), then verify:

- [ ] "Vis som tre" button appears next to "Preview" and opens the dark overlay.
- [ ] Synthetic "Prosjekter" root sits on top; top-level folders hang beneath it with precise elbow connectors (no overshoot).
- [ ] The folder you were in (its ancestors) is expanded; other branches are collapsed and show an "N ⌄" count.
- [ ] Clicking a folder toggles expand/collapse; clicking its count chip expands it.
- [ ] Items (repo/docs/…) appear as leaf nodes with the right icon; clicking one with a URL opens it in a new tab.
- [ ] Node text is centered; long names truncate with "…" and show the full name on hover.
- [ ] The active folder shows the lilla ring; the path to it is lilla, siblings dimmed.
- [ ] Hovering a folder shows the toolbar (Åpne · ＋ · rename · slett); right-click does not open the browser menu.
- [ ] "＋" opens the create menu; "Undermappe" opens the folder modal, "Repo/Lenke/Dokument/Fil" open the resource modal on the matching tab; creating adds the child under the right folder.
- [ ] "Gi nytt navn" turns the label into an inline input; Enter saves, Esc cancels.
- [ ] "Slett" opens the existing delete confirmation (above the overlay) and removes the folder + descendants.
- [ ] "Åpne" jumps to that folder in the normal view and closes the overlay.
- [ ] Drag the background to pan; wheel to zoom toward the cursor; the −/＋ buttons and % work; "Tilbakestill visning" re-fits.
- [ ] `Escape` and the X both close the overlay; the normal grid/preview views are unchanged.

- [ ] **Step 3: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "fix: folder-tree manual-verification adjustments"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** button ✓ (T11), interactive tree + expand/collapse ✓ (T3/T9/T10), pan/zoom/reset ✓ (T4/T5/T8/T10), open/add/rename/delete ✓ (T9/T10/T11), reuse existing data + handlers ✓ (T1/T11), modular module ✓ (T2–T10), SVG connectors ✓ (T6), centered uniform boxes + count-on-collapse ✓ (T3/T9), items as nodes + full "+" menu ✓ (T7/T9/T11), always-dark overlay ✓ (T10), synthetic root + default expansion + ephemeral pan/zoom ✓ (T3/T10).
- **Deferred (matches spec YAGNI):** drag-reorder in the tree, minimap, multi-select, item rename/delete from the tree, and `note`/`task` creation from "+" (the existing add-resource flow doesn't create those — folder/repo/link/app/file mirror the normal structure).
- **Type consistency:** `TreeNodeModel`/`TreeEdge`/`TreeLayout` from `buildTreeLayout` are consumed unchanged by `TreeConnectors`, `TreeNode`, `FolderTreeOverlay`; `AddKind` is defined once in `constants.ts` and flows page→overlay→menu→page; layout constants imported, never duplicated.
