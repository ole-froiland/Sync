'use client'

import type { InitProgressReport, MLCEngineInterface } from '@mlc-ai/web-llm'
import { LOCAL_AI_PLAN_SCHEMA, LOCAL_AI_SYSTEM_PROMPT } from './local-ai-contract.mjs'
import type { SyncAssistantCalendarEvent, SyncAssistantMessage } from './types'

const DEVICE_AI_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
let enginePromise: Promise<MLCEngineInterface> | null = null
let workerInstance: Worker | null = null

export type DeviceAiContext = {
  currentPath?: string
  now?: Date
  calendarEvents?: SyncAssistantCalendarEvent[]
}

export function supportsDeviceAi() {
  return typeof window !== 'undefined' && 'gpu' in navigator
}

export async function initializeDeviceAi(onProgress?: (report: InitProgressReport) => void) {
  if (!supportsDeviceAi()) throw new Error('Denne nettleseren støtter ikke lokal AI med WebGPU.')
  if (!enginePromise) {
    enginePromise = createEngine(onProgress).catch((error) => {
      enginePromise = null
      throw error
    })
  }
  const engine = await enginePromise
  if (onProgress) engine.setInitProgressCallback(onProgress)
  return engine
}

export async function planWithDeviceAi(
  messages: SyncAssistantMessage[],
  context: DeviceAiContext,
  onProgress?: (report: InitProgressReport) => void,
) {
  const engine = await initializeDeviceAi(onProgress)
  const response = await engine.chat.completions.create({
    stream: false,
    temperature: 0,
    max_tokens: 1_000,
    response_format: {
      type: 'json_object',
      schema: JSON.stringify(LOCAL_AI_PLAN_SCHEMA),
    },
    messages: [
      { role: 'system', content: LOCAL_AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          currentPath: context.currentPath ?? '/',
          currentProjectId: context.currentPath?.match(/^\/projects\/([^/?#]+)/)?.[1] ?? null,
          now: (context.now ?? new Date()).toISOString(),
          timezone: 'Europe/Oslo',
          localNow: osloLocalDateTime(context.now ?? new Date()),
          calendarEvents: (context.calendarEvents ?? []).slice(0, 100),
          conversation: messages.slice(-10),
        }),
      },
    ],
  })

  return parseDeviceAiOutput(response.choices[0]?.message?.content)
}

export async function shutdownDeviceAi() {
  const engine = await enginePromise?.catch(() => null)
  await engine?.unload()
  workerInstance?.terminate()
  workerInstance = null
  enginePromise = null
}

export function parseDeviceAiOutput(content: unknown) {
  if (typeof content !== 'string' || content.length > 100_000) return null
  try {
    const parsed = JSON.parse(content) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function createEngine(onProgress?: (report: InitProgressReport) => void) {
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
  workerInstance = new Worker(new URL('./browser-ai.worker.ts', import.meta.url), { type: 'module' })
  return CreateWebWorkerMLCEngine(workerInstance, DEVICE_AI_MODEL, {
    initProgressCallback: onProgress,
  })
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
