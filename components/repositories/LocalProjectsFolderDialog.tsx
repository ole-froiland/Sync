'use client'

import { useEffect, useId, useState } from 'react'
import { Check, Copy, FolderOpen } from 'lucide-react'
import { guessProjectsRoot, localRepoFolder } from './codeAgentLinks'

type LocalProjectsFolderDialogProps = {
  repoFullName: string
  cloneUrl: string
  initialValue: string
  onSave: (projectsRoot: string) => void
  onCancel: () => void
}

export default function LocalProjectsFolderDialog({
  repoFullName,
  cloneUrl,
  initialValue,
  onSave,
  onCancel,
}: LocalProjectsFolderDialogProps) {
  const [value, setValue] = useState(initialValue || guessProjectsRoot(repoFullName))
  const [copied, setCopied] = useState(false)
  const fieldId = useId()

  const folder = localRepoFolder(value, repoFullName)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const copyCloneCommand = async () => {
    try {
      await navigator.clipboard.writeText(`git clone ${cloneUrl}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const submit = () => {
    if (!folder) return
    onSave(value.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-purple-600 dark:text-purple-400" />
          <h2
            id={`${fieldId}-title`}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            Where do you keep projects on this computer?
          </h2>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Sync remembers this folder and opens every repository from it, in both Codex
          and Claude Code. You only pick it once.
        </p>

        <label
          htmlFor={fieldId}
          className="mt-4 block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Projects folder
        </label>
        <input
          id={fieldId}
          type="text"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            submit()
          }}
          placeholder="/Users/you/Projects"
          spellCheck={false}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />

        {folder ? (
          <p className="mt-1.5 break-all text-[11px] text-gray-400 dark:text-gray-500">
            This repository opens from {folder}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            Enter a full path that starts with a slash.
          </p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          Not sure of the path? In Finder, right-click the folder, hold Option and
          choose Copy as Pathname.
        </p>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Brand new repository? It has to be on your computer before either app can
            open it. Run this inside your projects folder first.
          </p>
          <button
            type="button"
            onClick={copyCloneCommand}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="truncate">git clone {cloneUrl}</span>
            {copied ? (
              <Check size={13} className="shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <Copy size={13} className="shrink-0 opacity-60" />
            )}
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!folder}
            className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save and open
          </button>
        </div>
      </div>
    </div>
  )
}
