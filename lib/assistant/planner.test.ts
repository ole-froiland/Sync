import { describe, expect, it } from 'vitest'
import { planLocalSyncResponse } from './planner'

describe('planLocalSyncResponse', () => {
  const now = new Date('2026-07-08T12:00:00')

  it('plans note creation from Norwegian input', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'legg til note: ring Ola' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'create_note', title: 'ring Ola' }])
  })

  it('plans calendar creation with tomorrow and time', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'lag kalenderaktivitet demo med teamet i morgen 10:30' }],
      { now }
    )

    expect(plan.actions[0]).toMatchObject({
      kind: 'create_calendar_event',
      title: 'demo med teamet',
      start: '2026-07-09T10:30:00',
      end: '2026-07-09T11:30:00',
    })
  })

  it('refuses requests outside Sync', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'hva er været i Tokyo?' }],
      { now }
    )

    expect(plan.outOfScope).toBe(true)
    expect(plan.actions).toEqual([])
  })

  it('opens settings as an overlay action', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'åpne settings' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'open_modal', modal: 'settings' }])
  })

  it('creates tasks from a project route', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'lag task: skriv readme' }],
      { now, currentPath: '/projects/project-123' }
    )

    expect(plan.actions).toEqual([
      { kind: 'create_task', projectId: 'project-123', title: 'skriv readme', status: 'todo' },
    ])
  })
})
