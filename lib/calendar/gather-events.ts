import type {
  CalendarConnectionRow,
  CalendarProvider,
  ExternalEvent,
} from './providers/types'

export type FetchEvents = (
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
) => Promise<ExternalEvent[]>

export type AdapterResolver = (
  provider: CalendarProvider,
) => Promise<FetchEvents | null>

export type ProviderError = { provider: string; message: string }

export type GatherResult = {
  events: ExternalEvent[]
  providerErrors: ProviderError[]
  failedConnectionIds: string[]
}

// Netlify functions are reaped around 10s; keep each provider safely under that
// so a slow connection (e.g. iCloud CalDAV) degrades to a per-provider error
// instead of taking down the whole calendar request.
const DEFAULT_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Fetches events from every connected provider in isolation. A failure in one
 * provider (bad credentials, a module that won't load, a hanging request) is
 * captured as a providerError and never prevents the other providers' events
 * from loading. This function does not throw.
 */
export async function gatherExternalEvents(
  connections: CalendarConnectionRow[],
  resolveAdapter: AdapterResolver,
  rangeStart: Date,
  rangeEnd: Date,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GatherResult> {
  const events: ExternalEvent[] = []
  const providerErrors: ProviderError[] = []
  const failedConnectionIds: string[] = []

  await Promise.all(
    connections.map(async (connection) => {
      try {
        const adapter = await resolveAdapter(connection.provider)
        if (!adapter) return
        const result = await withTimeout(
          adapter(connection, rangeStart, rangeEnd),
          timeoutMs,
          `${connection.provider} calendar`,
        )
        events.push(...result)
      } catch (caught) {
        providerErrors.push({
          provider: connection.provider,
          message: caught instanceof Error ? caught.message : 'Fetch failed',
        })
        failedConnectionIds.push(connection.id)
      }
    }),
  )

  return { events, providerErrors, failedConnectionIds }
}
