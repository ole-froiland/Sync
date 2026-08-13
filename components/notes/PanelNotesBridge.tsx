'use client'

import { useEffect } from 'react'
import { completeNote, createNote, listActive } from '@/lib/notes'
import {
  acknowledgePanelNoteCommand,
  publishNotesToPanel,
  pullPanelNoteCommands,
  type PanelNoteCommand,
} from '@/lib/panel-notes-sync'

const PROCESSED_KEY_PREFIX = 'sync-panel-note-commands:'

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

export default function PanelNotesBridge({ userId }: { userId: string }) {
  useEffect(() => {
    let cancelled = false
    let syncing = false
    async function sync() {
      if (syncing || cancelled) return
      syncing = true
      try {
        const processed = processedCommandIds(userId)
        const commands = await pullPanelNoteCommands()
        for (const command of commands) {
          if (!processed.has(command.id)) {
            await applyCommand(userId, command)
            rememberCommand(userId, command.id)
          }
          await acknowledgePanelNoteCommand(command.id)
        }
        await publishNotesToPanel(userId, await listActive())
      } catch {
        // The panel is optional; leased commands are retried after a short timeout.
      } finally {
        syncing = false
      }
    }
    void sync()
    const interval = window.setInterval(sync, 3_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [userId])

  return null
}
