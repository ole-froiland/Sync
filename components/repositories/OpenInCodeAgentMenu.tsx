'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { ChevronDown, SquareTerminal } from 'lucide-react'
import {
  claudeAppDeepLink,
  codexDeepLink,
  guessProjectsRoot,
  localRepoFolder,
  readLocalProjectsRoot,
  writeLocalProjectsRoot,
} from './codeAgentLinks'

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
  const [projectsRoot, setProjectsRoot] = useState('')
  const [askingForRoot, setAskingForRoot] = useState(false)
  const [rootDraft, setRootDraft] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rootInputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const localFolder = localRepoFolder(projectsRoot, repoFullName)

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

  useEffect(() => {
    if (askingForRoot) rootInputRef.current?.focus()
  }, [askingForRoot])

  const toggleMenu = () => {
    if (!open) {
      updateAlignment()
      setAskingForRoot(false)
      // Read on open so the menu picks up a root saved from another repository.
      setProjectsRoot(readLocalProjectsRoot())
    }
    setOpen((current) => !current)
  }

  const handleClaudeClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (localFolder) {
      setOpen(false)
      return
    }
    // Without a local folder Claude Code can only open an empty session, so ask
    // for the projects root instead of firing a deep link that looks like a no-op.
    event.preventDefault()
    setRootDraft(projectsRoot || guessProjectsRoot(repoFullName))
    setAskingForRoot(true)
  }

  // Codex resolves the repository from the clone URL on its own, so it must keep
  // opening even when no local folder is known.
  const handleCodexClick = () => setOpen(false)

  const saveProjectsRoot = () => {
    const trimmed = rootDraft.trim()
    if (!localRepoFolder(trimmed, repoFullName)) {
      rootInputRef.current?.focus()
      return
    }
    writeLocalProjectsRoot(trimmed)
    setProjectsRoot(trimmed)
    setAskingForRoot(false)
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
            href={codexDeepLink(cloneUrl, localFolder)}
            onClick={handleCodexClick}
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
            href={claudeAppDeepLink(repoFullName, defaultBranch, localFolder)}
            onClick={handleClaudeClick}
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

          {askingForRoot ? (
            <div className="border-t border-gray-100 px-3 pb-2 pt-2 dark:border-gray-800">
              <label
                htmlFor={`${panelId}-root`}
                className="block text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"
              >
                Is this where your projects are?
              </label>
              <input
                ref={rootInputRef}
                id={`${panelId}-root`}
                type="text"
                value={rootDraft}
                onChange={(event) => setRootDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  saveProjectsRoot()
                }}
                placeholder="/Users/you/Projects"
                spellCheck={false}
                autoComplete="off"
                className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={saveProjectsRoot}
                className="mt-1.5 w-full rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Yes, use this folder
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                Wrong? In Finder, right-click the folder holding your projects, hold
                Option and choose Copy as Pathname, then paste it here.
              </p>
            </div>
          ) : (
            <p className="border-t border-gray-100 px-3 pb-1 pt-1.5 text-[11px] leading-relaxed text-gray-400 dark:border-gray-800 dark:text-gray-500">
              {localFolder
                ? 'Both open the repository straight in the app.'
                : 'Set your local projects folder once to open the right repository in either app.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
