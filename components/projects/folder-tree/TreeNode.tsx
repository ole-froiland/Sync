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
import type { TreeNodeModel } from './buildTreeLayout'

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
      {/* folder toolbar */}
      {!isItem && !isRoot && !renaming && (
        <div
          data-no-drag
          className={cn(
            'absolute bottom-full left-1/2 z-10 mb-2.5 -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-white/12 bg-[#1b1e26] p-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)]',
            toolbarVisibility
          )}
        >
          <ToolbarBtn label="Åpne" onClick={onOpen}><FolderOpen size={15} /></ToolbarBtn>
          <ToolbarBtn label="Legg til" accent onClick={onAdd}><Plus size={15} /></ToolbarBtn>
          <ToolbarBtn label="Gi nytt navn" onClick={onStartRename}><Pencil size={15} /></ToolbarBtn>
          <ToolbarBtn label="Slett" danger onClick={onDelete}><Trash2 size={15} /></ToolbarBtn>
        </div>
      )}

      {/* item toolbar */}
      {isItem && (
        <div
          data-no-drag
          className={cn(
            'absolute bottom-full left-1/2 z-10 mb-2.5 -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-white/12 bg-[#1b1e26] p-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)]',
            toolbarVisibility
          )}
        >
          <ToolbarBtn label="Åpne" onClick={onOpen}><ExternalLink size={15} /></ToolbarBtn>
          <ToolbarBtn label="Slett" danger onClick={onDelete}><Trash2 size={15} /></ToolbarBtn>
        </div>
      )}

      {/* the box */}
      <div
        title={node.label}
        className={cn(
          'flex h-full w-full cursor-grab select-none items-center justify-center gap-2 rounded-[11px] border px-3.5 text-[13px] font-medium shadow-[0_2px_10px_-3px_rgba(0,0,0,0.75)] transition active:cursor-grabbing',
          isDropTarget
            ? 'border-emerald-400/70 bg-[#15241d] text-emerald-50 ring-2 ring-emerald-400/50'
            : selected
            ? 'border-violet-400 bg-[#1f1a30] text-violet-100 ring-2 ring-violet-400/40'
            : node.isCurrent
            ? 'border-violet-400/70 bg-[#1f1a30] text-violet-100'
            : node.onPath
            ? 'border-violet-400/30 bg-[#181b23] text-gray-100'
            : 'border-white/12 bg-[#171a22] text-gray-300 hover:border-white/25 hover:bg-[#1c2029]'
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

      {/* expand/collapse control */}
      {!isItem && node.hasChildren && (
        <button
          type="button"
          data-no-drag
          onClick={onToggle}
          aria-label={node.expanded ? 'Skjul undermapper' : 'Vis undermapper'}
          className="absolute left-1/2 top-full z-[4] mt-1 flex h-[21px] -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-[#1b1e26] px-1.5 text-[11px] font-semibold text-gray-300 transition hover:text-gray-100"
        >
          {!node.expanded && <span>{node.childCount}</span>}
          <motion.span
            className="inline-flex"
            animate={{ rotate: node.expanded ? 180 : 0 }}
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
        'flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white/10',
        danger ? 'text-red-400' : accent ? 'text-violet-300' : 'text-gray-300'
      )}
    >
      {children}
    </button>
  )
}
