import { describe, expect, it } from 'vitest'
import { automaticBrowserAction, buildAssistantProjectFolder } from './client-actions'
import type { SyncAssistantActionEnvelope } from './types'

function envelope(
  action: SyncAssistantActionEnvelope['action'],
  requiresConfirmation = false
): SyncAssistantActionEnvelope {
  return {
    id: 'action-1',
    action,
    label: 'Action',
    description: 'Description',
    risk: requiresConfirmation ? 'write' : 'navigation',
    requiresConfirmation,
  }
}

describe('assistant client actions', () => {
  it('auto-runs one safe navigation or modal action', () => {
    const navigation = envelope({ kind: 'navigate', href: '/calendar' })
    const modal = envelope({ kind: 'open_modal', modal: 'settings' })

    expect(automaticBrowserAction([navigation])).toBe(navigation)
    expect(automaticBrowserAction([modal])).toBe(modal)
  })

  it('does not auto-run writes or multi-action plans', () => {
    const note = envelope({ kind: 'create_note', title: 'Ring Ola' }, true)
    const navigation = envelope({ kind: 'navigate', href: '/notes' })

    expect(automaticBrowserAction([note])).toBeNull()
    expect(automaticBrowserAction([navigation, note])).toBeNull()
  })

  it('builds a project folder compatible with the Projects page', () => {
    expect(
      buildAssistantProjectFolder(
        { kind: 'create_project_folder', name: 'Ny nettside', description: 'Kundearbeid' },
        { id: 'user-1', name: 'Ole', avatar_url: null },
        { id: 'folder-ai-1', now: '2026-07-11T08:00:00.000Z' }
      )
    ).toEqual({
      id: 'folder-ai-1',
      name: 'Ny nettside',
      description: 'Kundearbeid',
      color: 'bg-fuchsia-600',
      logo: { type: 'icon', value: 'folder' },
      createdAt: '2026-07-11T08:00:00.000Z',
      members: [{ id: 'user-1', name: 'Ole', avatar_url: null, role: 'creator' }],
      items: [],
    })
  })
})
