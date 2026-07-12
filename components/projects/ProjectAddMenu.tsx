'use client'

import { useState } from 'react'
import { FolderGit2, FolderPlus, Link2, PanelsTopLeft, Plus, Upload } from 'lucide-react'

type ResourceMode = 'github' | 'url' | 'document' | 'app'

interface Props {
  onAddFolder: () => void
  onAddResource?: (mode: ResourceMode) => void
  resourcesAvailable?: boolean
}

const resourceActions: Array<{ label: string; mode: ResourceMode; icon: React.ElementType }> = [
  { label: 'Repo', mode: 'github', icon: FolderGit2 },
  { label: 'Lenke', mode: 'url', icon: Link2 },
  { label: 'Dokument eller Excel', mode: 'app', icon: PanelsTopLeft },
  { label: 'Last opp fil', mode: 'document', icon: Upload },
]

/** A single entry point for creating folders and their contents. */
export default function ProjectAddMenu({ onAddFolder, onAddResource, resourcesAvailable = true }: Props) {
  const [open, setOpen] = useState(false)

  function addFolder() {
    onAddFolder()
    setOpen(false)
  }

  function addResource(mode: ResourceMode) {
    onAddResource?.(mode)
    setOpen(false)
  }

  return (
    <div className="relative">
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button type="button" role="menuitem" onClick={addFolder} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
            <FolderPlus size={16} className="text-fuchsia-600 dark:text-fuchsia-300" />
            Ny mappe
          </button>
          {resourcesAvailable && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              {resourceActions.map(({ label, mode, icon: Icon }) => (
                <button key={mode} type="button" role="menuitem" onClick={() => addResource(mode)} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
                  <Icon size={16} className="text-gray-400 dark:text-gray-500" />
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      >
        <Plus size={16} />
        Legg til
      </button>
    </div>
  )
}
