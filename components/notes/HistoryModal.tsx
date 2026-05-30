'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { listCompleted } from '@/lib/notes'
import type { Note } from '@/types/notes'

type Props = {
  open: boolean
  onClose: () => void
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function HistoryModal({ open, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // setState calls here are intentional resets before the async fetch.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    setError(null)
    listCompleted()
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="History">
      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && notes.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No completed notes yet.</p>
      )}
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{note.title}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Created: {formatTimestamp(note.created_at)}</span>
              {note.completed_at && <span>Completed: {formatTimestamp(note.completed_at)}</span>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
