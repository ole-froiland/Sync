'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ExternalLink,
  Folder,
  FolderOpen,
  GitBranch,
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
import type { TreeNodeModel, TreeOrientation } from './buildTreeLayout'

const ITEM_ICONS: Record<ProjectItem['type'], React.ElementType> = {
  note: StickyNote,
  link: Link2,
  url: Link2,
  file: Upload,
  document: Upload,
  task: CheckSquare,
  github: GitBranch,
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
  orientation: TreeOrientation
  renaming: boolean
  selected: boolean
  isDropTarget: boolean
  onToggle: () => void
  onOpen: () => void
  onAdd: () => void
  onStartRename: () => void
  onSubmitRename: (name: string) => void
  onCancelRename: () => void
  onDelete: () => void
}

export default function TreeNode({
  node,
  orientation,
  renaming,
  selected,
  isDropTarget,
  onToggle,
  onOpen,
  onAdd,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
}: Props) {
  const isItem = node.kind === 'item'
  const isRoot = node.kind === 'root'
  const Icon = isItem && node.itemType ? ITEM_ICONS[node.itemType] : node.onPath ? FolderOpen : Folder
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const toolbarVisibility = selected ? 'flex' : 'hidden group-hover:flex'

  return (
    <div className="group relative h-full w-full">
      {/* action toolbar — shows on hover / when selected. The hidden ::before
          bridge spans the gap so the cursor can reach it without losing hover. */}
      {!renaming && (
        <div
          data-no-drag
          className={cn(
            "absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 items-center gap-1 rounded-xl border border-white/15 bg-[#272d3a] p-1.5 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.95)] before:absolute before:left-0 before:right-0 before:top-full before:h-3 before:content-['']",
            toolbarVisibility
          )}
        >
          {node.kind === 'folder' && (
            <ToolbarBtn label="Åpne" onClick={onOpen}>
              <FolderOpen size={16} />
            </ToolbarBtn>
          )}
          {isItem && (
            <ToolbarBtn label="Åpne" onClick={onOpen}>
              <ExternalLink size={16} />
            </ToolbarBtn>
          )}
          {!isItem && (
            <ToolbarBtn label={isRoot ? 'Ny topp-mappe' : 'Legg til'} accent onClick={onAdd}>
              <Plus size={16} />
            </ToolbarBtn>
          )}
          {node.kind === 'folder' && (
            <ToolbarBtn label="Gi nytt navn" onClick={onStartRename}>
              <Pencil size={16} />
            </ToolbarBtn>
          )}
          {(node.kind === 'folder' || isItem) && (
            <ToolbarBtn label="Slett" danger onClick={onDelete}>
              <Trash2 size={16} />
            </ToolbarBtn>
          )}
        </div>
      )}

      {/* the box */}
      <div
        title={node.label}
        className={cn(
          'flex h-full w-full cursor-grab select-none items-center justify-center gap-2 rounded-[11px] border px-3.5 text-[13px] font-medium shadow-[0_4px_14px_-3px_rgba(0,0,0,0.6)] transition active:cursor-grabbing',
          isDropTarget
            ? 'border-emerald-400 bg-[#1c3128] text-emerald-50 ring-2 ring-emerald-400/60'
            : selected
            ? 'border-violet-400 bg-[#2c2647] text-white ring-2 ring-violet-400/50'
            : node.isCurrent
            ? 'border-violet-400/70 bg-[#2a2442] text-violet-50'
            : node.onPath
            ? 'border-violet-400/40 bg-[#262433] text-gray-100'
            : 'border-white/15 bg-[#242a35] text-gray-200 hover:border-white/30 hover:bg-[#2b323f]'
        )}
      >
        <Icon
          size={16}
          className={cn(
            'shrink-0',
            isDropTarget
              ? 'text-emerald-300'
              : node.isCurrent || selected
              ? 'text-violet-300'
              : node.onPath
              ? 'text-violet-400/80'
              : isItem
              ? 'text-gray-400'
              : 'text-gray-300'
          )}
        />
        {renaming ? (
          <input
            ref={inputRef}
            data-no-drag
            defaultValue={node.label}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') onSubmitRename(e.currentTarget.value.trim() || node.label)
              if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={(e) => onSubmitRename(e.currentTarget.value.trim() || node.label)}
            className="min-w-0 flex-1 bg-transparent text-center text-gray-100 outline-none"
          />
        ) : (
          <span className="min-w-0 truncate">{node.label}</span>
        )}
      </div>

      {/* expand/collapse control (under the node when vertical, to its right when horizontal) */}
      {!isItem && node.hasChildren && (
        <button
          type="button"
          data-no-drag
          onClick={onToggle}
          aria-label={node.expanded ? 'Skjul undermapper' : 'Vis undermapper'}
          className={cn(
            'absolute z-[4] flex h-[22px] items-center gap-1 rounded-full border border-white/20 bg-[#242a35] px-1.5 text-[11px] font-semibold text-gray-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.7)] transition hover:bg-[#2b323f] hover:text-gray-100',
            orientation === 'horizontal' ? 'left-full top-1/2 ml-1 -translate-y-1/2' : 'left-1/2 top-full mt-1 -translate-x-1/2'
          )}
        >
          {!node.expanded && <span>{node.childCount}</span>}
          <motion.span
            className="inline-flex"
            animate={{ rotate: node.expanded ? (orientation === 'horizontal' ? 90 : 180) : orientation === 'horizontal' ? -90 : 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ChevronDown size={12} />
          </motion.span>
        </button>
      )}
    </div>
  )
}

function ToolbarBtn({
  children,
  label,
  accent,
  danger,
  onClick,
}: {
  children: React.ReactNode
  label: string
  accent?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-no-drag
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/15',
        danger ? 'text-red-400 hover:text-red-300' : accent ? 'text-violet-300 hover:text-violet-200' : 'text-gray-200 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}
