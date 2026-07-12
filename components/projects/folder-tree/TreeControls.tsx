'use client'

import { ChevronsDown, ChevronsUp, Frame, Minus, Plus } from 'lucide-react'

interface Props {
  scalePercent: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export default function TreeControls({ scalePercent, onZoomIn, onZoomOut, onReset, onExpandAll, onCollapseAll }: Props) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-wrap items-center justify-end gap-2">
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
      <div className="flex items-center rounded-xl border border-white/10 bg-[#0f1115] p-1">
        <button type="button" onClick={onExpandAll} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
          <ChevronsDown size={14} />
          Åpne alt
        </button>
        <button type="button" onClick={onCollapseAll} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
          <ChevronsUp size={14} />
          Lukk alt
        </button>
      </div>
    </div>
  )
}
