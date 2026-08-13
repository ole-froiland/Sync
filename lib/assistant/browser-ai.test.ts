import { describe, expect, it } from 'vitest'
import { parseDeviceAiOutput } from './browser-ai'

describe('browser AI output', () => {
  it('parses a structured plan', () => {
    expect(parseDeviceAiOutput('{"reply":"Klart","outOfScope":false,"actions":[]}')).toEqual({
      reply: 'Klart',
      outOfScope: false,
      actions: [],
    })
  })

  it('rejects malformed, non-object, and oversized output', () => {
    expect(parseDeviceAiOutput('not json')).toBeNull()
    expect(parseDeviceAiOutput('[]')).toBeNull()
    expect(parseDeviceAiOutput('"text"')).toBeNull()
    expect(parseDeviceAiOutput('x'.repeat(100_001))).toBeNull()
  })
})
