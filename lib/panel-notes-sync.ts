import type { Note } from '@/types/notes'

export const PANEL_NOTES_ENDPOINT = 'http://127.0.0.1:4173/api/sync-notes'
const LOOPBACK_FETCH_OPTIONS = { targetAddressSpace: 'loopback' } as const

export type PanelNote = {
  id: string
  title: string
  createdAt: string
}

export type PanelNoteCommand =
  | { id: string; type: 'create'; title: string }
  | { id: string; type: 'complete'; noteId: string }

export function notesForPanel(notes: Note[]): PanelNote[] {
  return notes
    .filter((note) => Boolean(note.id && note.title.trim() && !note.completed_at && Number.isFinite(+new Date(note.created_at))))
    .map((note) => ({ id: note.id, title: note.title.trim(), createdAt: new Date(note.created_at).toISOString() }))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export async function publishNotesToPanel(userId: string, notes: Note[], fetcher: typeof fetch = fetch) {
  const response = await fetcher(PANEL_NOTES_ENDPOINT, {
    ...LOOPBACK_FETCH_OPTIONS,
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ kind: 'snapshot', userId, notes: notesForPanel(notes) }),
  })
  if (!response.ok) throw new Error(`Panel notes sync failed (${response.status})`)
}

export async function pullPanelNoteCommands(fetcher: typeof fetch = fetch): Promise<PanelNoteCommand[]> {
  const response = await fetcher(`${PANEL_NOTES_ENDPOINT}?commands=1`, {
    ...LOOPBACK_FETCH_OPTIONS,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Panel notes command pull failed (${response.status})`)
  const payload = (await response.json()) as { commands?: PanelNoteCommand[] }
  return Array.isArray(payload.commands) ? payload.commands : []
}

export async function acknowledgePanelNoteCommand(commandId: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(PANEL_NOTES_ENDPOINT, {
    ...LOOPBACK_FETCH_OPTIONS,
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ kind: 'ack', commandId }),
  })
  if (!response.ok) throw new Error(`Panel notes command acknowledgement failed (${response.status})`)
}
