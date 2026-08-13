import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  normalizeAssistantAction,
  type SyncAssistantAction,
  type SyncAssistantCalendarEvent,
  type SyncAssistantMessage,
  type SyncAssistantPlan,
} from './types'

export type LocalGemmaContext = {
  currentPath?: string
  now?: Date
  calendarEvents?: SyncAssistantCalendarEvent[]
}

type BridgeResult = {
  id?: unknown
  body?: unknown
  signature?: unknown
}

const RESPONSE_TIMEOUT_MS = 28_000
const AVAILABILITY_TIMEOUT_MS = 1_200

export async function planLocalGemmaResponse(
  messages: SyncAssistantMessage[],
  context: LocalGemmaContext,
): Promise<SyncAssistantPlan | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const token = process.env.LOCAL_AI_BRIDGE_TOKEN
  if (!supabaseUrl || !supabaseKey || !token) return null

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const topic = bridgeTopic(token)
  const id = randomUUID()
  const request = {
    messages: messages.slice(-10),
    currentPath: context.currentPath ?? '/',
    currentProjectId: projectIdFromPath(context.currentPath),
    now: (context.now ?? new Date()).toISOString(),
    timezone: 'Europe/Oslo',
    localNow: osloLocalDateTime(context.now ?? new Date()),
    calendarEvents: (context.calendarEvents ?? []).slice(0, 100),
  }
  const body = encryptBody(request, token)
  const signature = signBridgePayload(token, id, body)

  let available = false
  let finished = false
  let availabilityTimer: ReturnType<typeof setTimeout> | null = null
  let responseTimer: ReturnType<typeof setTimeout> | null = null

  try {
    return await new Promise<SyncAssistantPlan | null>((resolve) => {
      const finish = (plan: SyncAssistantPlan | null) => {
        if (finished) return
        finished = true
        if (availabilityTimer) clearTimeout(availabilityTimer)
        if (responseTimer) clearTimeout(responseTimer)
        resolve(plan)
      }

      const channel = client
        .channel(topic, { config: { broadcast: { ack: true } } })
        .on('broadcast', { event: 'pong' }, (payload) => {
          const value = payload.payload as BridgeResult
          if (!validBridgeEnvelope(value, token, id)) return
          available = true
          if (availabilityTimer) clearTimeout(availabilityTimer)
          responseTimer = setTimeout(() => finish(null), RESPONSE_TIMEOUT_MS)
          void channel.send({ type: 'broadcast', event: 'job', payload: { id, body, signature } })
        })
        .on('broadcast', { event: 'result' }, (payload) => {
          const value = payload.payload as BridgeResult
          if (!validBridgeEnvelope(value, token, id) || typeof value.body !== 'string') return
          const raw = decryptBody(value.body, token)
          finish(normalizeLocalModelPlan(raw, context))
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          const pingBody = encryptBody({ ping: true }, token)
          void channel.send({
            type: 'broadcast',
            event: 'ping',
            payload: { id, body: pingBody, signature: signBridgePayload(token, id, pingBody) },
          })
          availabilityTimer = setTimeout(() => {
            if (!available) finish(null)
          }, AVAILABILITY_TIMEOUT_MS)
        })
    })
  } finally {
    await client.removeAllChannels()
  }
}

export function normalizeLocalModelPlan(raw: unknown, context: LocalGemmaContext): SyncAssistantPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const reply = typeof value.reply === 'string' ? value.reply.trim().slice(0, 2400) : ''
  if (!reply || !Array.isArray(value.actions)) return null

  const requestedActions = value.actions.slice(0, 3)
  const actions = requestedActions
    .map(normalizeAssistantAction)
    .filter((action): action is SyncAssistantAction => Boolean(action))
    .map((action) => constrainAction(action, context))
    .filter((action): action is SyncAssistantAction => Boolean(action))

  if (requestedActions.length > 0 && actions.length === 0) return null
  return {
    reply: actions.length > 0 ? confirmationReply(actions) : reply,
    actions,
    outOfScope: value.outOfScope === true,
  }
}

function confirmationReply(actions: SyncAssistantAction[]) {
  if (actions.length > 1) return `Jeg har gjort ${actions.length} Sync-handlinger klare. Kontroller dem og bekreft før noe endres.`
  const action = actions[0]
  switch (action.kind) {
    case 'create_note':
      return `Jeg har gjort notatet «${action.title}» klart. Bekreft for å lagre det.`
    case 'complete_note':
      return `Jeg har funnet notatet${action.title ? ` «${action.title}»` : ''}. Bekreft for å markere det som ferdig.`
    case 'create_calendar_event':
      return `Jeg har gjort kalenderhendelsen «${action.title}» klar. Kontroller tidspunktet og bekreft.`
    case 'create_calendar_events':
      return `Jeg har gjort ${action.events.length} ${action.events.length === 1 ? 'kalenderhendelse' : 'kalenderhendelser'} klare. Kontroller datoene og bekreft.`
    case 'update_calendar_events':
      return `Jeg har gjort endringen av ${action.events.length} ${action.events.length === 1 ? 'kalenderhendelse' : 'kalenderhendelser'} klar. Kontroller og bekreft.`
    case 'delete_calendar_events':
      return `Jeg fant ${action.events.length} ${action.events.length === 1 ? 'kalenderhendelse' : 'kalenderhendelser'} som skal slettes. Kontroller og bekreft.`
    case 'create_project_folder':
      return `Jeg har gjort prosjektområdet «${action.name}» klart. Bekreft for å opprette det.`
    case 'create_task':
      return `Jeg har gjort oppgaven «${action.title}» klar. Bekreft for å opprette den.`
    case 'create_post':
      return `Jeg har laget et utkast med tittelen «${action.title}». Kontroller teksten og bekreft.`
    case 'set_language':
      return `Jeg har gjort språkbyttet til ${action.locale === 'no' ? 'norsk' : 'engelsk'} klart. Bekreft for å bytte.`
    case 'navigate':
    case 'open_modal':
    case 'open_projects_tree':
      return 'Jeg åpner dette i Sync.'
  }
  return 'Jeg har gjort Sync-handlingen klar. Kontroller og bekreft.'
}

function constrainAction(action: SyncAssistantAction, context: LocalGemmaContext): SyncAssistantAction | null {
  if (action.kind === 'create_task') {
    const currentProjectId = projectIdFromPath(context.currentPath)
    return currentProjectId && action.projectId === currentProjectId ? action : null
  }

  if (action.kind === 'delete_calendar_events') {
    const existing = new Map((context.calendarEvents ?? []).filter((event) => event.id).map((event) => [event.id, event]))
    const events = action.events.flatMap((event) => event.id && existing.has(event.id) ? [existing.get(event.id)!] : [])
    return events.length > 0 ? { kind: action.kind, events } : null
  }

  if (action.kind === 'update_calendar_events') {
    const ids = new Set((context.calendarEvents ?? []).map((event) => event.id).filter(Boolean))
    const events = action.events.filter((event) => event.id && ids.has(event.id))
    return events.length > 0 ? { kind: action.kind, events } : null
  }

  return action
}

export function bridgeTopic(token: string) {
  return `sync-local-ai-${createHash('sha256').update(token).digest('hex').slice(0, 32)}`
}

export function signBridgePayload(token: string, id: string, body: string) {
  return createHmac('sha256', token).update(`${id}.${body}`).digest('hex')
}

export function validBridgeEnvelope(value: BridgeResult, token: string, expectedId: string) {
  if (value.id !== expectedId || typeof value.body !== 'string' || typeof value.signature !== 'string') return false
  const expected = signBridgePayload(token, expectedId, value.body)
  const actualBuffer = Buffer.from(value.signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function encryptBody(value: unknown, token: string) {
  const key = createHash('sha256').update(token).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptBody(value: string, token: string) {
  try {
    const [ivValue, tagValue, ciphertextValue] = value.split('.')
    if (!ivValue || !tagValue || !ciphertextValue) return null
    const key = createHash('sha256').update(token).digest()
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return JSON.parse(plaintext) as unknown
  } catch {
    return null
  }
}

function projectIdFromPath(path?: string) {
  return path?.match(/^\/projects\/([^/?#]+)/)?.[1] ?? null
}

function osloLocalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`
}
