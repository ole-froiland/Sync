'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
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
  onAdd,
}: StageProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(folders, currentFolderId))
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
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

  // Escape closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        onClick={() => setMenuFolderId(null)}
        {...bind}
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
          {layout.nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              renaming={renamingId === node.id}
              onToggle={toggle}
              onOpen={openNode}
              onAdd={(id) => setMenuFolderId((cur) => (cur === id ? null : id))}
              onStartRename={setRenamingId}
              onSubmitRename={(id, name) => {
                onRenameFolder(id, name)
                setRenamingId(null)
              }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={onDeleteFolder}
            />
          ))}

          {menuFolder && menuNode && (
            <div
              className="absolute z-20"
              style={{ left: menuNode.x, top: menuNode.y + 52, transform: 'translateX(-50%)' }}
              onClick={(e) => e.stopPropagation()}
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
