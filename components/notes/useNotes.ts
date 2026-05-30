'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createNote, completeNote, listActive, removeNote } from '@/lib/notes'
import type { Note } from '@/types/notes'

type UseNotesResult = {
  notes: Note[]
  loading: boolean
  error: string | null
  add: (title: string) => Promise<void>
  complete: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useNotes(userId: string | undefined): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notesRef = useRef<Note[]>([])
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  // Initial fetch. setState calls here are intentional resets before the async fetch.
  useEffect(() => {
    if (!userId) {
      setNotes([]) // eslint-disable-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotes([])
    listActive()
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load notes')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Realtime subscription.
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Note
            if (row.completed_at) return
            setNotes((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]))
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Note
            setNotes((prev) =>
              row.completed_at ? prev.filter((n) => n.id !== row.id) : prev.map((n) => (n.id === row.id ? row : n)),
            )
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Note
            setNotes((prev) => prev.filter((n) => n.id !== oldRow.id))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const add = useCallback(
    async (title: string) => {
      const trimmed = title.trim()
      if (!trimmed || !userId) return
      // Optimistic insert with a temporary id.
      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: Note = {
        id: tempId,
        user_id: userId,
        title: trimmed,
        created_at: new Date().toISOString(),
        completed_at: null,
        updated_at: new Date().toISOString(),
      }
      setNotes((prev) => [optimistic, ...prev])
      setError(null)
      try {
        const saved = await createNote(trimmed, userId)
        setNotes((prev) => {
          // Replace temp row if realtime hasn't already.
          const withoutTemp = prev.filter((n) => n.id !== tempId)
          return withoutTemp.some((n) => n.id === saved.id) ? withoutTemp : [saved, ...withoutTemp]
        })
      } catch (err) {
        setNotes((prev) => prev.filter((n) => n.id !== tempId))
        setError(err instanceof Error ? err.message : 'Failed to add note')
      }
    },
    [userId],
  )

  const complete = useCallback(async (id: string) => {
    const snapshot = notesRef.current
    setError(null)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await completeNote(id)
    } catch (err) {
      setNotes(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to complete note')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    const snapshot = notesRef.current
    setError(null)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await removeNote(id)
    } catch (err) {
      setNotes(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }, [])

  return { notes, loading, error, add, complete, remove }
}
