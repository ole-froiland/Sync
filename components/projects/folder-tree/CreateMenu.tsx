'use client'

import { Folder, GitBranch, Link2, PanelsTopLeft, Upload } from 'lucide-react'
import type { AddKind } from './constants'

interface Props {
  folderLabel: string
  onPick: (kind: AddKind) => void
}

const ITEMS: Array<{ kind: AddKind; label: string; icon: React.ElementType; accent?: boolean }> = [
  { kind: 'subfolder', label: 'Undermappe', icon: Folder, accent: true },
  { kind: 'repo', label: 'Repo', icon: GitBranch },
  { kind: 'link', label: 'Lenke / URL', icon: Link2 },
  { kind: 'app', label: 'Dokument', icon: PanelsTopLeft },
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
