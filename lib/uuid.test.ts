import { describe, expect, it } from 'vitest'
import { isUuid } from './uuid'

describe('isUuid', () => {
  it('accepts canonical v4 uuids', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isUuid('123E4567-E89B-42D3-A456-426614174000')).toBe(true)
  })

  it('rejects values that could break out of a PostgREST or() filter', () => {
    expect(isUuid('')).toBe(false)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000,sender_id.eq.x')).toBe(false)
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000)')).toBe(false)
    expect(isUuid('123e4567e89b42d3a456426614174000')).toBe(false)
  })
})
