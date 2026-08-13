import { describe, expect, it, vi } from 'vitest'
import { notesForPanel, publishNotesToPanel } from './panel-notes-sync'
import type { Note } from '@/types/notes'

const note: Note = {
  id: 'note-1',
  user_id: 'user-1',
  title: ' Ring Ola ',
  created_at: '2026-08-12T10:00:00Z',
  completed_at: null,
  updated_at: '2026-08-12T10:00:00Z',
}

describe('panel notes sync', () => {
  it('publishes only active, valid notes in newest-first order', () => {
    expect(notesForPanel([
      { ...note, id: 'older', created_at: '2026-08-11T10:00:00Z' },
      note,
      { ...note, id: 'done', completed_at: '2026-08-12T11:00:00Z' },
    ])).toEqual([
      { id: 'note-1', title: 'Ring Ola', createdAt: '2026-08-12T10:00:00.000Z' },
      { id: 'older', title: 'Ring Ola', createdAt: '2026-08-11T10:00:00.000Z' },
    ])
  })

  it('posts the user snapshot to the local panel bridge', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    await publishNotesToPanel('user-1', [note], fetcher)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4173/api/sync-notes', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }))
  })
})
