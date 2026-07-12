'use client'

import { useState } from 'react'
import { ChevronsDown, ChevronsUp, Frame, Minus, Plus, SlidersHorizontal } from 'lucide-react'

interface Props {
  scalePercent: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export default function TreeControls({ scalePercent, onZoomIn, onZoomOut, onReset, onExpandAll, onCollapseAll }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  function runMenuAction(action: () => void) {
    action()
    setMenuOpen(false)
  }

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
      <div className="relative">
        {menuOpen && (
          <div role="menu" className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-white/10 bg-[#0f1115] p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.95)]">
            <button type="button" role="menuitem" onClick={() => runMenuAction(onReset)} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
              <Frame size={15} />
              Tilbakestill visning
            </button>
            <div className="my-1 border-t border-white/10" />
            <button type="button" role="menuitem" onClick={() => runMenuAction(onExpandAll)} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
              <ChevronsDown size={15} />
              Åpne hele treet
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(onCollapseAll)} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100">
              <ChevronsUp size={15} />
              Lukk hele treet
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#0f1115] px-3 text-[12px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-gray-100"
        >
          <SlidersHorizontal size={15} />
          Visning
        </button>
      </div>
    </div>
  )
}
