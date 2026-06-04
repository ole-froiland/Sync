'use client'

import { X } from 'lucide-react'
import type { Note } from '@/types/notes'

type Props = {
  note: Note
  onComplete: (id: string) => void
  onRemove: (id: string) => void
  draggable?: boolean
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function NoteRow({ note, onComplete, onRemove, draggable = false }: Props) {
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return
        event.dataTransfer.effectAllowed = 'copy'
        event.dataTransfer.setData(
          'application/x-sync-note',
          JSON.stringify({ id: note.id, title: note.title }),
        )
        event.dataTransfer.setData('text/plain', note.title)
      }}
      className={`flex items-start gap-3 rounded-lg border border-gray-100 p-2 dark:border-gray-800 ${
        draggable ? 'cursor-grab transition hover:border-purple-200 active:cursor-grabbing dark:hover:border-purple-800' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={false}
        onChange={() => onComplete(note.id)}
        aria-label="Mark note as done"
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{note.title}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(note.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(note.id)}
        aria-label="Delete note"
        className="p-1 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
      >
        <X size={16} />
      </button>
    </div>
  )
}
