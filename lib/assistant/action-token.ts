import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import type { SyncAssistantAction } from './types'

type TokenPayload = {
  userId: string
  action: SyncAssistantAction
  expiresAt: number
  nonce: string
}

export function actionTokenSecret() {
  if (process.env.AI_ACTION_SECRET) return process.env.AI_ACTION_SECRET
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  if (process.env.NODE_ENV !== 'production') return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sync-dev-action-secret'
  return ''
}

export function createActionToken(userId: string, action: SyncAssistantAction, secret = actionTokenSecret(), now = Date.now()) {
  if (!secret) return null
  const payload: TokenPayload = {
    userId,
    action,
    expiresAt: now + 5 * 60 * 1000,
    nonce: randomUUID(),
  }
  const body = encode(JSON.stringify(payload))
  const signature = sign(body, secret)
  return `${body}.${signature}`
}

export function verifyActionToken(token: string, userId: string, secret = actionTokenSecret(), now = Date.now()) {
  if (!secret) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = sign(body, secret)
  if (!safeEqual(signature, expected)) return null

  try {
    const payload = JSON.parse(decode(body)) as TokenPayload
    if (payload.userId !== userId) return null
    if (payload.expiresAt < now) return null
    return payload.action
  } catch {
    return null
  }
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
