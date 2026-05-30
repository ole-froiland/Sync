'use client'

import { useState } from 'react'
import { Clock3, ExternalLink, History } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import { useNotes } from './useNotes'
import NoteRow from './NoteRow'
import NoteComposer from './NoteComposer'
import HistoryModal from './HistoryModal'

type Variant = 'embedded' | 'standalone'

type Props = {
  variant: Variant
}

export default function NotesPanel({ variant }: Props) {
  const user = useUser()
  const { notes, loading, error, add, complete, remove } = useNotes(user?.id)
  const [historyOpen, setHistoryOpen] = useState(false)

  const isEmbedded = variant === 'embedded'

  return (
    <section
      className={
        isEmbedded
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
          : 'flex h-full flex-col bg-white dark:bg-gray-900'
      }
    >
      <div className={isEmbedded ? 'flex items-center justify-between' : 'flex items-center justify-between px-4 pt-4'}>
        <div>
          <p
            className={
              isEmbedded
                ? 'text-sm font-semibold text-gray-900 dark:text-gray-100'
                : 'text-xl font-semibold text-gray-900 dark:text-gray-100'
            }
          >
            Notes
          </p>
          {isEmbedded && <p className="text-xs text-gray-500 dark:text-gray-400">Quick capture.</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open history"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <History size={16} />
          </button>
          {isEmbedded && (
            <a
              href="/notes"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in new tab"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <ExternalLink size={16} />
            </a>
          )}
          {!isEmbedded && <Clock3 size={16} className="text-gray-400 dark:text-gray-500" />}
        </div>
      </div>

      <div className={isEmbedded ? 'mt-3 flex-1 space-y-2 overflow-y-auto' : 'mt-3 flex-1 space-y-2 overflow-y-auto px-4'}>
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && notes.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No notes yet. Write your first note below.
          </p>
        )}
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} onComplete={complete} onRemove={remove} />
        ))}
      </div>

      <div className={isEmbedded ? 'mt-3' : 'border-t border-gray-100 p-4 dark:border-gray-800'}>
        <NoteComposer onAdd={add} />
      </div>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </section>
  )
}
