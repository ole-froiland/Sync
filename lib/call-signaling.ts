import { isUuid } from './uuid'

export const CALL_SIGNAL_MAX_AGE_MS = 60_000

export const CALL_SIGNAL_KINDS = ['offer', 'answer', 'reject', 'end'] as const
export type CallSignalKind = (typeof CALL_SIGNAL_KINDS)[number]
export type CallMedia = 'audio' | 'video'

export type CallSignalPayload = {
  media: CallMedia
  description?: {
    type: 'offer' | 'answer'
    sdp: string
  }
}

export type CallSignal = {
  id: number
  call_id: string
  sender_id: string
  receiver_id: string
  kind: CallSignalKind
  payload: CallSignalPayload
  created_at: string
  sender?: {
    id: string
    name: string
    avatar_url: string | null
  }
}

export function isCallSignalKind(value: unknown): value is CallSignalKind {
  return typeof value === 'string' && CALL_SIGNAL_KINDS.includes(value as CallSignalKind)
}

export function isCallMedia(value: unknown): value is CallMedia {
  return value === 'audio' || value === 'video'
}

export function parseCallSignalPayload(value: unknown, kind: CallSignalKind): CallSignalPayload | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  if (!isCallMedia(payload.media)) return null

  if (kind === 'offer' || kind === 'answer') {
    if (!payload.description || typeof payload.description !== 'object') return null
    const description = payload.description as Record<string, unknown>
    if (description.type !== kind || typeof description.sdp !== 'string') return null
    if (!description.sdp || description.sdp.length > 100_000) return null
    return {
      media: payload.media,
      description: { type: kind, sdp: description.sdp },
    }
  }

  return { media: payload.media }
}

export function parseCallSignal(value: unknown): CallSignal | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'number' ||
    typeof row.call_id !== 'string' ||
    !isUuid(row.call_id) ||
    typeof row.sender_id !== 'string' ||
    !isUuid(row.sender_id) ||
    typeof row.receiver_id !== 'string' ||
    !isUuid(row.receiver_id) ||
    !isCallSignalKind(row.kind) ||
    typeof row.created_at !== 'string'
  ) {
    return null
  }

  const payload = parseCallSignalPayload(row.payload, row.kind)
  if (!payload) return null

  const senderValue = row.sender
  const sender =
    senderValue && typeof senderValue === 'object'
      ? (senderValue as Record<string, unknown>)
      : null
  const parsedSender =
    sender &&
    typeof sender.id === 'string' &&
    typeof sender.name === 'string' &&
    (typeof sender.avatar_url === 'string' || sender.avatar_url === null)
      ? { id: sender.id, name: sender.name, avatar_url: sender.avatar_url }
      : undefined

  return {
    id: row.id,
    call_id: row.call_id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    kind: row.kind,
    payload,
    created_at: row.created_at,
    sender: parsedSender,
  }
}

export function isFreshCallOffer(createdAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(createdAt)
  return Number.isFinite(timestamp) && timestamp <= now + 5_000 && now - timestamp <= CALL_SIGNAL_MAX_AGE_MS
}
