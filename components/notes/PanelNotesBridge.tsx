'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { completeNote, createNote, listActive } from '@/lib/notes'
import {
  acknowledgePanelNoteCommand,
  publishNotesToPanel,
  pullPanelNoteCommands,
  type PanelNoteCommand,
} from '@/lib/panel-notes-sync'
import type { Note } from '@/types/notes'

const PROCESSED_KEY_PREFIX = 'sync-panel-note-commands:'
const PANEL_POLL_MS = 3_000

function processedCommandIds(userId: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(`${PROCESSED_KEY_PREFIX}${userId}`) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function rememberCommand(userId: string, commandId: string) {
  const ids = [...processedCommandIds(userId), commandId].slice(-100)
  window.localStorage.setItem(`${PROCESSED_KEY_PREFIX}${userId}`, JSON.stringify(ids))
}

async function applyCommand(userId: string, command: PanelNoteCommand) {
  if (command.type === 'create') {
    await createNote(command.title, userId)
    return
  }
  await completeNote(command.noteId)
}

// Panelet spørres hvert tredje sekund fordi det ligger på loopback og ikke
// koster noe. Notatene ligger derimot i Supabase, og å lese dem i samme takt
// var det som brukte opp egress-kvoten: den samme lista ble hentet 1200 ganger
// i timen så lenge en fane sto åpen. Her leses de bare når de faktisk er endret
// — Realtime sier fra — og ellers gjenbrukes forrige snapshot.
export default function PanelNotesBridge({ userId }: { userId: string }) {
  useEffect(() => {
    let cancelled = false
    let syncing = false
    let snapshot: Note[] | null = null
    let notesStale = true

    async function pump() {
      if (syncing || cancelled) return
      syncing = true
      try {
        const processed = processedCommandIds(userId)
        // Er panelet nede, kaster denne før vi har rørt Supabase. Det er med
        // vilje: en avslått Mac skal ikke koste databasetrafikk.
        const commands = await pullPanelNoteCommands()
        for (const command of commands) {
          if (!processed.has(command.id)) {
            await applyCommand(userId, command)
            rememberCommand(userId, command.id)
            notesStale = true
          }
          await acknowledgePanelNoteCommand(command.id)
        }
        if (notesStale || snapshot === null) {
          snapshot = await listActive()
          notesStale = false
        }
        // Feiler publiseringen, beholder vi snapshotet og prøver igjen med det
        // samme neste runde — uten å hente notatene på nytt.
        await publishNotesToPanel(userId, snapshot)
      } catch {
        // The panel is optional; leased commands are retried after a short timeout.
      } finally {
        syncing = false
      }
    }

    void pump()
    const interval = window.setInterval(pump, PANEL_POLL_MS)

    const supabase = createClient()
    const channel = supabase
      .channel(`panel-notes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => {
          notesStale = true
          void pump()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [userId])

  return null
}
