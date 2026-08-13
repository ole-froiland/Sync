import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { LOCAL_AI_PLAN_SCHEMA, LOCAL_AI_SYSTEM_PROMPT } from '../lib/assistant/local-ai-contract.mjs'
import { LocalAiLoadGuard } from '../lib/assistant/local-ai-load-guard.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const selectedEnv = await readSelectedEnv(join(rootDir, '.env.local'))
const supabaseUrl = selectedEnv.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = selectedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
const bridgeToken = keychainSecret('sync-local-ai-bridge')
const model = process.env.LOCAL_AI_MODEL || 'gemma4:latest'
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'

if (!supabaseUrl || !supabaseKey || !bridgeToken) {
  console.error('[Sync Local AI] Mangler Supabase-oppsett eller nøkkelringtoken.')
  process.exit(1)
}

const topic = `sync-local-ai-${createHash('sha256').update(bridgeToken).digest('hex').slice(0, 32)}`
const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { reconnectAfterMs: (tries) => Math.min(1_000 * 2 ** tries, 30_000) },
})
const processed = new Map()
const loadGuard = new LocalAiLoadGuard({ maxPending: 2, maxPerWindow: 8, windowMs: 60_000 })
let chain = Promise.resolve()

const channel = client
  .channel(topic, { config: { broadcast: { ack: true } } })
  .on('broadcast', { event: 'ping' }, (message) => {
    const envelope = message.payload
    if (!validEnvelope(envelope)) return
    void channel.send({ type: 'broadcast', event: 'pong', payload: envelope })
  })
  .on('broadcast', { event: 'job' }, (message) => {
    const envelope = message.payload
    if (!validEnvelope(envelope) || processed.has(envelope.id)) return
    processed.set(envelope.id, Date.now())
    pruneProcessed()
    if (!loadGuard.tryStart()) {
      void sendPlan(envelope.id, {
        reply: 'Den lokale AI-en er opptatt akkurat nå. Vent litt og prøv igjen.',
        actions: [],
        outOfScope: false,
      }).catch((error) => {
        console.error('[Sync Local AI] Klarte ikke å sende opptatt-svar:', error instanceof Error ? error.message : 'ukjent feil')
      })
      return
    }
    chain = chain
      .then(() => handleJob(envelope))
      .catch((error) => {
        console.error('[Sync Local AI] Jobb feilet:', error instanceof Error ? error.message : 'ukjent feil')
      })
      .finally(() => loadGuard.finish())
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[Sync Local AI] Klar med ${model}.`)
      void warmModel()
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`[Sync Local AI] Realtime-status: ${status}`)
    }
  })

async function handleJob(envelope) {
  const request = decryptBody(envelope.body)
  if (!validRequest(request)) return

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: LOCAL_AI_PLAN_SCHEMA,
      keep_alive: '30m',
      options: { temperature: 0, num_ctx: 8_192, num_predict: 1_000 },
      messages: [
        { role: 'system', content: LOCAL_AI_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            currentPath: request.currentPath,
            currentProjectId: request.currentProjectId,
            now: request.now,
            timezone: request.timezone,
            localNow: request.localNow,
            calendarEvents: request.calendarEvents,
            conversation: request.messages,
          }),
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`Ollama svarte ${response.status}`)
  const data = await response.json()
  const content = data?.message?.content
  if (typeof content !== 'string') throw new Error('Ollama manglet strukturert svar')

  let plan
  try {
    plan = JSON.parse(content)
  } catch {
    throw new Error('Ollama returnerte ugyldig JSON')
  }

  await sendPlan(envelope.id, plan)
}

async function sendPlan(id, plan) {
  const body = encryptBody(plan)
  await channel.send({
    type: 'broadcast',
    event: 'result',
    payload: { id, body, signature: sign(id, body) },
  })
}

async function warmModel() {
  try {
    await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        prompt: 'Svar kun OK.',
        stream: false,
        keep_alive: '30m',
        options: { num_predict: 2 },
      }),
    })
  } catch {
    console.error('[Sync Local AI] Ollama er ikke tilgjengelig ennå; prøver igjen ved første melding.')
  }
}

function validEnvelope(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.body !== 'string' || typeof value.signature !== 'string') return false
  const expected = sign(value.id, value.body)
  const actualBuffer = Buffer.from(value.signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function validRequest(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray(value.messages)
    && value.messages.length > 0
    && value.messages.length <= 10
    && typeof value.now === 'string'
    && value.timezone === 'Europe/Oslo'
    && typeof value.localNow === 'string'
    && Array.isArray(value.calendarEvents),
  )
}

function sign(id, body) {
  return createHmac('sha256', bridgeToken).update(`${id}.${body}`).digest('hex')
}

function encryptBody(value) {
  const key = createHash('sha256').update(bridgeToken).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptBody(value) {
  try {
    const [ivValue, tagValue, ciphertextValue] = value.split('.')
    if (!ivValue || !tagValue || !ciphertextValue) return null
    const key = createHash('sha256').update(bridgeToken).digest()
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return JSON.parse(plaintext)
  } catch {
    return null
  }
}

function keychainSecret(service) {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-w', '-s', service], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

async function readSelectedEnv(path) {
  try {
    const text = await readFile(path, 'utf8')
    const allowed = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
    return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || !allowed.has(match[1])) return []
      return [[match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2')]]
    }))
  } catch {
    return {}
  }
}

function pruneProcessed() {
  const cutoff = Date.now() - 10 * 60_000
  for (const [id, timestamp] of processed) {
    if (timestamp < cutoff) processed.delete(id)
  }
}

async function shutdown() {
  await client.removeAllChannels()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
