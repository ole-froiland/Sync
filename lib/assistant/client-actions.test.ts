import { describe, expect, it } from 'vitest'
import { applyCalendarAction, automaticBrowserAction, buildAssistantProjectFolder, calendarEventsForAction } from './client-actions'
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
    const projectTree = envelope({ kind: 'open_projects_tree' })

    expect(automaticBrowserAction([navigation])).toBe(navigation)
    expect(automaticBrowserAction([modal])).toBe(modal)
    expect(automaticBrowserAction([projectTree])).toBe(projectTree)
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

  it('turns a bulk calendar action into stable local calendar events', () => {
    const events = calendarEventsForAction({
      kind: 'create_calendar_events',
      sourceLabel: 'PremierLeague.com',
      events: [
        {
          id: 'pl-1',
          title: 'Hull City – Manchester United',
          start: '2026-08-22T11:30:00.000Z',
          end: '2026-08-22T13:30:00.000Z',
          eventKind: 'meeting',
          sourceUrl: 'https://www.premierleague.com/en/clubs/1/fixtures',
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: 'cal-ai-pl-1',
      title: 'Hull City – Manchester United',
      kind: 'meeting',
      tone: 'violet',
      note: 'Kilde: https://www.premierleague.com/en/clubs/1/fixtures',
    })
  })

  it('updates and deletes exact local calendar events without touching others', () => {
    const existing = [
      { id: 'cal-ai-training-1', title: 'Trening', start: '2026-08-18T18:00:00', end: '2026-08-18T20:00:00', kind: 'focus' as const, tone: 'sky' as const },
      { id: 'cal-other', title: 'Møte', start: '2026-08-18T10:00:00', end: '2026-08-18T11:00:00', kind: 'meeting' as const, tone: 'violet' as const },
    ]
    const updated = applyCalendarAction(existing, {
      kind: 'update_calendar_events',
      events: [{ id: 'cal-ai-training-1', title: 'Trening', start: '2026-08-18T19:00:00', end: '2026-08-18T21:00:00', eventKind: 'focus' }],
    })
    expect(updated.find((event) => event.id === 'cal-ai-training-1')?.start).toBe('2026-08-18T19:00:00')
    expect(updated).toHaveLength(2)

    const deleted = applyCalendarAction(updated, {
      kind: 'delete_calendar_events',
      events: [{ id: 'cal-ai-training-1', title: 'Trening', start: '2026-08-18T19:00:00', end: '2026-08-18T21:00:00' }],
    })
    expect(deleted.map((event) => event.id)).toEqual(['cal-other'])
  })
})
