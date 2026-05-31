import { describe, it, expect } from 'vitest'
import { upsertEvent, removeEvent } from './event-mutations'

type E = { id: string; start: string; title?: string }
const a: E = { id: 'a', start: '2026-05-12T09:00:00', title: 'A' }
const b: E = { id: 'b', start: '2026-05-12T11:00:00', title: 'B' }

describe('upsertEvent', () => {
  it('appends a new event and returns the list sorted by start', () => {
    const out = upsertEvent([b], a)
    expect(out.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('replaces an existing event by id and re-sorts', () => {
    const out = upsertEvent([a, b], { id: 'a', start: '2026-05-12T12:00:00', title: 'A2' })
    expect(out).toHaveLength(2)
    expect(out.map((e) => e.id)).toEqual(['b', 'a'])
    expect(out.find((e) => e.id === 'a')?.title).toBe('A2')
  })
})

describe('removeEvent', () => {
  it('removes the matching id', () => {
    expect(removeEvent([a, b], 'a').map((e) => e.id)).toEqual(['b'])
  })

  it('leaves the list unchanged when the id is not found', () => {
    expect(removeEvent([a, b], 'z').map((e) => e.id)).toEqual(['a', 'b'])
  })
})
