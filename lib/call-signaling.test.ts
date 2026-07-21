import { describe, expect, it } from 'vitest'
import {
  isFreshCallOffer,
  parseCallControlMessage,
  parseCallSignal,
  parseCallSignalPayload,
} from './call-signaling'

const offer = {
  id: 1,
  call_id: '123e4567-e89b-42d3-a456-426614174000',
  sender_id: '223e4567-e89b-42d3-a456-426614174000',
  receiver_id: '323e4567-e89b-42d3-a456-426614174000',
  kind: 'offer',
  payload: {
    media: 'video',
    description: { type: 'offer', sdp: 'v=0' },
  },
  created_at: '2026-07-21T12:00:00.000Z',
}

describe('call signaling', () => {
  it('accepts a valid WebRTC offer signal', () => {
    expect(parseCallSignal(offer)).toMatchObject({
      call_id: offer.call_id,
      kind: 'offer',
      payload: { media: 'video' },
    })
  })

  it('rejects mismatched descriptions and oversized SDP payloads', () => {
    expect(
      parseCallSignalPayload(
        { media: 'audio', description: { type: 'answer', sdp: 'v=0' } },
        'offer'
      )
    ).toBeNull()
    expect(
      parseCallSignalPayload(
        { media: 'audio', description: { type: 'offer', sdp: 'x'.repeat(100_001) } },
        'offer'
      )
    ).toBeNull()
  })

  it('rejects malformed ids before they reach PostgREST filters', () => {
    expect(parseCallSignal({ ...offer, call_id: `${offer.call_id}),sender_id.eq.anyone` })).toBeNull()
  })

  it('only treats recent offers as ringable', () => {
    const now = Date.parse('2026-07-21T12:01:00.000Z')
    expect(isFreshCallOffer('2026-07-21T12:00:00.001Z', now)).toBe(true)
    expect(isFreshCallOffer('2026-07-21T11:59:59.999Z', now)).toBe(false)
    expect(isFreshCallOffer('not-a-date', now)).toBe(false)
  })

  it('accepts only valid screen-sharing control messages', () => {
    expect(parseCallControlMessage('{"type":"screen-share","active":true}')).toEqual({
      type: 'screen-share',
      active: true,
    })
    expect(parseCallControlMessage({ type: 'screen-share', active: false })).toEqual({
      type: 'screen-share',
      active: false,
    })
    expect(parseCallControlMessage('{not-json')).toBeNull()
    expect(parseCallControlMessage({ type: 'screen-share', active: 'yes' })).toBeNull()
    expect(parseCallControlMessage({ type: 'unknown', active: true })).toBeNull()
  })
})
