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
  localRepoFolder,
  readLocalProjectsRoot,
  writeLocalProjectsRoot,
} from './codeAgentLinks'
import LocalProjectsFolderDialog from './LocalProjectsFolderDialog'

type CodeAgent = 'codex' | 'claude'

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
  const [pendingAgent, setPendingAgent] = useState<CodeAgent | null>(null)
  const [editingRoot, setEditingRoot] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
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

  const toggleMenu = () => {
    if (!open) {
      updateAlignment()
      // Read on open so the menu picks up a root saved from another repository.
      setProjectsRoot(readLocalProjectsRoot())
    }
    setOpen((current) => !current)
  }

  const agentLink = (agent: CodeAgent, folder: string | null) =>
    agent === 'codex'
      ? codexDeepLink(cloneUrl, folder)
      : claudeAppDeepLink(repoFullName, defaultBranch, folder)

  const handleAgentClick = (agent: CodeAgent) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (localFolder) {
      setOpen(false)
      return
    }
    // Neither app can open a repository it cannot find on disk, so ask once and
    // resume the click afterwards instead of firing a link that does nothing.
    event.preventDefault()
    setPendingAgent(agent)
    setOpen(false)
  }

  const saveProjectsRoot = (projectsRootValue: string) => {
    writeLocalProjectsRoot(projectsRootValue)
    setProjectsRoot(projectsRootValue)

    const folder = localRepoFolder(projectsRootValue, repoFullName)
    const agent = pendingAgent
    setPendingAgent(null)
    setEditingRoot(false)

    if (agent && folder) window.location.href = agentLink(agent, folder)
  }

  const closeDialog = () => {
    setPendingAgent(null)
    setEditingRoot(false)
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
            onClick={handleAgentClick('codex')}
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
            onClick={handleAgentClick('claude')}
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

          <div className="border-t border-gray-100 px-3 pb-1.5 pt-1.5 dark:border-gray-800">
            <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {localFolder
                ? 'Both open this repository straight from your projects folder.'
                : 'Set your local projects folder once to open the right repository in either app.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingRoot(true)
                setOpen(false)
              }}
              className="mt-1 text-[11px] font-medium text-purple-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-400"
            >
              {localFolder ? 'Change folder' : 'Choose folder'}
            </button>
          </div>
        </div>
      )}

      {(pendingAgent || editingRoot) && (
        <LocalProjectsFolderDialog
          repoFullName={repoFullName}
          cloneUrl={cloneUrl}
          initialValue={projectsRoot}
          onSave={saveProjectsRoot}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}
