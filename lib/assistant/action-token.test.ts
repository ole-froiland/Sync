import { describe, expect, it } from 'vitest'
import { createActionToken, verifyActionToken } from './action-token'

describe('assistant action tokens', () => {
  it('verifies untampered tokens', () => {
    const token = createActionToken(
      'user-1',
      { kind: 'create_note', title: 'hello' },
      'secret',
      1000
    )

    expect(token).toBeTruthy()
    expect(verifyActionToken(token!, 'user-1', 'secret', 1000)).toEqual({
      kind: 'create_note',
      title: 'hello',
    })
  })

  it('rejects another user', () => {
    const token = createActionToken(
      'user-1',
      { kind: 'create_note', title: 'hello' },
      'secret',
      1000
    )

    expect(verifyActionToken(token!, 'user-2', 'secret', 1000)).toBeNull()
  })

  it('rejects expired tokens', () => {
    const token = createActionToken(
      'user-1',
      { kind: 'create_note', title: 'hello' },
      'secret',
      1000
    )

    expect(verifyActionToken(token!, 'user-1', 'secret', 1000 + 6 * 60 * 1000)).toBeNull()
  })
})
