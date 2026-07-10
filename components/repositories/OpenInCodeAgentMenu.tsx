'use client'

import Image from 'next/image'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, SquareTerminal } from 'lucide-react'
import { claudeAppDeepLink, codexDeepLink } from './codeAgentLinks'

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900'

type OpenInCodeAgentMenuProps = {
  cloneUrl: string
  repoFullName: string
  defaultBranch: string
}

export default function OpenInCodeAgentMenu({
  cloneUrl,
  repoFullName,
  defaultBranch,
}: OpenInCodeAgentMenuProps) {
  const [open, setOpen] = useState(false)
  const [alignment, setAlignment] = useState<'left' | 'right'>('right')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const updateAlignment = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const viewportGutter = 16
    const panelWidth = Math.min(208, window.innerWidth - viewportGutter * 2)
    const rect = button.getBoundingClientRect()
    const roomOnLeft = rect.right - viewportGutter
    const roomOnRight = window.innerWidth - viewportGutter - rect.left

    setAlignment(roomOnRight >= panelWidth || roomOnRight >= roomOnLeft ? 'left' : 'right')
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updateAlignment)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updateAlignment)
    }
  }, [open, updateAlignment])

  const toggleMenu = () => {
    if (!open) updateAlignment()
    setOpen((current) => !current)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className={BUTTON_CLASS}
        aria-label="Open in a code agent"
        aria-controls={panelId}
        aria-expanded={open}
      >
        <SquareTerminal size={13} />
        Open in
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div
          id={panelId}
          className={`absolute z-20 mt-1.5 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900 ${
            alignment === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <a
            href={codexDeepLink(cloneUrl)}
            onClick={() => setOpen(false)}
            aria-label="Open in ChatGPT Codex"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Image
              src="/brand/chatgpt-logo.png"
              alt=""
              width={16}
              height={16}
              aria-hidden="true"
              className="rounded-sm"
            />
            ChatGPT Codex
          </a>
          <a
            href={claudeAppDeepLink(repoFullName, defaultBranch)}
            onClick={() => setOpen(false)}
            aria-label="Open in Claude Code"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Image
              src="/brand/claude-logo.svg"
              alt=""
              width={16}
              height={16}
              aria-hidden="true"
            />
            Claude Code
          </a>
          <p className="border-t border-gray-100 px-3 pb-1 pt-1.5 text-[11px] leading-relaxed text-gray-400 dark:border-gray-800 dark:text-gray-500">
            Codex matches a known workspace. Claude may ask you to choose the local folder.
          </p>
        </div>
      )}
    </div>
  )
}
