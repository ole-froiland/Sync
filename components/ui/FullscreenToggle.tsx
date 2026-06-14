'use client'

import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

// Safari still uses webkit-prefixed fullscreen APIs.
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function fullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null
}

export default function FullscreenToggle() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(Boolean(fullscreenElement()))
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  async function toggle() {
    try {
      if (fullscreenElement()) {
        const doc = document as FsDocument
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      } else {
        const el = document.documentElement as FsElement
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
      }
    } catch {
      // Fullscreen can be blocked (permissions policy / embedded contexts). Ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? 'Avslutt fullskjerm' : 'Fullskjerm'}
      title={active ? 'Avslutt fullskjerm' : 'Fullskjerm'}
      className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
    >
      {active ? <Minimize size={17} /> : <Maximize size={17} />}
    </button>
  )
}
