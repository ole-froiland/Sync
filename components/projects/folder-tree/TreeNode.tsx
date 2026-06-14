'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  return (
    <div className="group relative h-full w-full">
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
            defaultValue={node.label}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Keep Enter/Escape inside the rename field — don't let them reach
              // the overlay's window-level Escape handler (which would close it).
              e.stopPropagation()
              if (e.key === 'Enter') onSubmitRename(node.id, e.currentTarget.value.trim() || node.label)
              if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={(e) => onSubmitRename(node.id, e.currentTarget.value.trim() || node.label)}
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
