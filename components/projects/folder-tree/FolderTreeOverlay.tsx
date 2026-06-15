'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Folder, X } from 'lucide-react'
import type { ProjectFolder, ProjectItem } from '@/types'
import type { AddKind } from './constants'
import { NODE_H, NODE_W, ROOT_ID } from './constants'
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
  onDeleteItem: (itemId: string, folderId: string) => void
  onAdd: (folderId: string, kind: AddKind) => void
  onMoveFolder: (folderId: string, targetParentId: string | null) => void
  onMoveItem: (itemId: string, targetFolderId: string) => void
  canMoveFolder: (folderId: string, targetParentId: string | null) => boolean
}

type StageProps = Omit<Props, 'open'>

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

/** Collapse every folder that is not an ancestor of the current folder. */
function defaultCollapsed(folders: ProjectFolder[], currentFolderId: string | null): Set<string> {
  const keepOpen = ancestorsOf(folders, currentFolderId)
  const next = new Set<string>()
  for (const f of folders) if (!keepOpen.has(f.id)) next.add(f.id)
  return next
}

function findItem(folders: ProjectFolder[], itemId: string): ProjectItem | undefined {
  for (const f of folders) {
    const found = f.items?.find((i) => i.id === itemId)
    if (found) return found
  }
  return undefined
}

export default function FolderTreeOverlay({ open, ...stage }: Props) {
  if (typeof document === 'undefined' || !open) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[900] flex flex-col bg-[#08090c]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <TreeStage {...stage} />
    </motion.div>,
    document.body
  )
}

type PressState = { x: number; y: number; nodeId: string | null; active: boolean }

/**
 * The interactive stage. Mounted fresh each time the overlay opens, so the
 * default collapsed set is computed once via useState (no effect needed).
 */
function TreeStage({
  folders,
  currentFolderId,
  onClose,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteItem,
  onAdd,
  onMoveFolder,
  onMoveItem,
  canMoveFolder,
}: StageProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(folders, currentFolderId))
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<PressState | null>(null)
  const { transform, bind, zoomIn, zoomOut, fit } = usePanZoom()

  const layout = useMemo(
    () => buildTreeLayout(folders, { collapsed, currentId: currentFolderId }),
    [folders, collapsed, currentFolderId]
  )

  // Re-fit whenever the laid-out content size changes.
  useLayoutEffect(() => {
    if (!viewportRef.current) return
    const { clientWidth, clientHeight } = viewportRef.current
    fit(layout.width, layout.height, clientWidth, clientHeight)
  }, [layout.width, layout.height, fit])

  // Escape backs out one layer at a time: rename → menu → selection → close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (renamingId) setRenamingId(null)
      else if (menuFolderId) setMenuFolderId(null)
      else if (selectedId) setSelectedId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, renamingId, menuFolderId, selectedId])

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

  /** Screen point → which folder/root box is under it, if a valid drop target. */
  function computeDrop(clientX: number, clientY: number, dragNodeId: string): string | null {
    const vp = viewportRef.current
    if (!vp) return null
    const r = vp.getBoundingClientRect()
    const cx = (clientX - r.left - transform.tx) / transform.scale
    const cy = (clientY - r.top - transform.ty) / transform.scale
    const dragNode = layout.nodes.find((n) => n.id === dragNodeId)
    if (!dragNode || dragNode.kind === 'root') return null
    for (const n of layout.nodes) {
      if (n.kind === 'item') continue
      if (n.id === dragNodeId) continue
      if (cx < n.x - NODE_W / 2 || cx > n.x + NODE_W / 2 || cy < n.y || cy > n.y + NODE_H) continue
      if (dragNode.kind === 'item') {
        if (n.kind === 'root') return null
        if (n.id === dragNode.parentId) return null
        return n.id
      }
      // dragging a folder
      if (n.id === dragNode.parentId) return null
      const targetParent = n.kind === 'root' ? null : n.id
      if (!canMoveFolder(dragNode.id, targetParent)) return null
      return n.id
    }
    return null
  }

  function applyMove(dragNodeId: string, targetId: string) {
    const dragNode = layout.nodes.find((n) => n.id === dragNodeId)
    if (!dragNode) return
    if (dragNode.kind === 'folder') {
      onMoveFolder(dragNodeId, targetId === ROOT_ID ? null : targetId)
    } else if (dragNode.kind === 'item' && targetId !== ROOT_ID) {
      onMoveItem(dragNodeId, targetId)
    }
    // reveal the destination folder so the moved box is visible
    if (targetId !== ROOT_ID) {
      setCollapsed((prev) => {
        if (!prev.has(targetId)) return prev
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  function onStagePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('[data-no-drag]')) return
    const nodeEl = target.closest('[data-node-id]') as HTMLElement | null
    const nodeId = nodeEl?.getAttribute('data-node-id') ?? null
    pressRef.current = { x: e.clientX, y: e.clientY, nodeId, active: false }
    if (!nodeId) bind.onPointerDown(e)
  }

  function onStagePointerMove(e: React.PointerEvent) {
    const pr = pressRef.current
    if (!pr) return
    const moved = Math.hypot(e.clientX - pr.x, e.clientY - pr.y) >= 5
    if (pr.nodeId) {
      if (!pr.active && !moved) return
      pr.active = true
      setGhost({ nodeId: pr.nodeId, x: e.clientX, y: e.clientY })
      setDropTargetId(computeDrop(e.clientX, e.clientY, pr.nodeId))
    } else {
      if (moved) pr.active = true
      bind.onPointerMove(e)
    }
  }

  function onStagePointerUp(e: React.PointerEvent) {
    const pr = pressRef.current
    pressRef.current = null
    if (pr?.nodeId) {
      if (pr.active) {
        const target = computeDrop(e.clientX, e.clientY, pr.nodeId)
        if (target) applyMove(pr.nodeId, target)
      } else {
        setSelectedId(pr.nodeId === ROOT_ID ? null : pr.nodeId)
        setMenuFolderId(null)
      }
      setGhost(null)
      setDropTargetId(null)
    } else {
      bind.onPointerUp(e)
      if (pr && !pr.active) {
        setSelectedId(null)
        setMenuFolderId(null)
      }
    }
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
  const ghostNode = ghost ? layout.nodes.find((n) => n.id === ghost.nodeId) : null

  return (
    <>
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-gray-200">Mappetre</span>
          <span className="text-[12px] font-medium text-gray-500">
            Prosjekter
            {breadcrumb.map((n) => (
              <span key={n}>
                <span className="mx-1.5 text-gray-700">/</span>
                <span className="text-gray-300">{n}</span>
              </span>
            ))}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-white/[0.07] bg-[#0f1115] text-gray-400 transition hover:text-gray-100"
        >
          <X size={15} />
        </button>
      </div>

      {/* stage */}
      <div
        ref={viewportRef}
        className="relative flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onWheel={bind.onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
            width: layout.width,
            height: layout.height,
          }}
        >
          <TreeConnectors nodes={layout.nodes} edges={layout.edges} width={layout.width} height={layout.height} />
          <AnimatePresence>
            {layout.nodes.map((node) => (
              <motion.div
                key={node.id}
                data-node-id={node.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{ position: 'absolute', left: node.x - NODE_W / 2, top: node.y, width: NODE_W, height: NODE_H }}
              >
                <TreeNode
                  node={node}
                  renaming={renamingId === node.id}
                  selected={selectedId === node.id}
                  isDropTarget={dropTargetId === node.id}
                  onToggle={() => toggle(node.id)}
                  onOpen={() => openNode(node)}
                  onAdd={() => setMenuFolderId((cur) => (cur === node.id ? null : node.id))}
                  onStartRename={() => setRenamingId(node.id)}
                  onSubmitRename={(name) => {
                    onRenameFolder(node.id, name)
                    setRenamingId(null)
                  }}
                  onCancelRename={() => setRenamingId(null)}
                  onDelete={() => {
                    if (node.kind === 'item') {
                      if (node.parentId) onDeleteItem(node.id, node.parentId)
                    } else {
                      onDeleteFolder(node.id)
                    }
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {menuFolder && menuNode && (
            <div
              data-no-drag
              className="absolute z-20"
              style={{ left: menuNode.x, top: menuNode.y + 52, transform: 'translateX(-50%)' }}
            >
              <CreateMenu
                folderLabel={menuFolder.name}
                onPick={(kind) => {
                  onAdd(menuFolder.id, kind)
                  setMenuFolderId(null)
                }}
              />
            </div>
          )}
        </div>

        {ghost && ghostNode && (
          <div
            className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-[11px] border border-violet-400/60 bg-[#1f1a30]/95 px-3 py-2 text-[13px] font-medium text-violet-100 shadow-[0_14px_34px_-10px_rgba(0,0,0,0.85)]"
            style={{ left: ghost.x + 14, top: ghost.y + 12 }}
          >
            <Folder size={15} className="text-violet-300" />
            <span className="max-w-[160px] truncate">{ghostNode.label}</span>
          </div>
        )}

        <TreeControls
          scalePercent={Math.round(transform.scale * 100)}
          onZoomIn={() => {
            const r = viewportRef.current!.getBoundingClientRect()
            zoomIn(r.width / 2, r.height / 2)
          }}
          onZoomOut={() => {
            const r = viewportRef.current!.getBoundingClientRect()
            zoomOut(r.width / 2, r.height / 2)
          }}
          onReset={() => {
            const r = viewportRef.current!.getBoundingClientRect()
            fit(layout.width, layout.height, r.width, r.height)
          }}
        />
      </div>
    </>
  )
}
