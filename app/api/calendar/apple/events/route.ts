import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { mutateEvents, type AppleMutation, type AppleWritableEvent } from '@/lib/calendar/providers/apple'
import type { CalendarConnectionRow } from '@/lib/calendar/providers/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MutationBody = {
  operation?: unknown
  events?: unknown
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as MutationBody
  const mutation = normalizeMutation(body)
  if (!mutation) return NextResponse.json({ error: 'Invalid Apple Calendar mutation' }, { status: 400 })

  const { data: connection, error } = await auth.supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('provider', 'apple')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!connection) {
    return NextResponse.json({ error: 'Apple Calendar is not connected', code: 'APPLE_NOT_CONNECTED' }, { status: 409 })
  }

  try {
    const results = await mutateEvents(connection as CalendarConnectionRow, mutation)
    return NextResponse.json({ provider: 'apple', results })
  } catch (writeError) {
    return NextResponse.json({
      error: writeError instanceof Error ? writeError.message : 'Apple Calendar write failed',
    }, { status: 502 })
  }
}

function normalizeMutation(body: MutationBody): AppleMutation | null {
  if (body.operation !== 'create' && body.operation !== 'update' && body.operation !== 'delete') return null
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 100) return null

  if (body.operation === 'delete') {
    const events = body.events.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const id = shortString((raw as Record<string, unknown>).id, 400)
      return id ? [{ id }] : []
    })
    return events.length === body.events.length ? { operation: body.operation, events } : null
  }

  const events = body.events.flatMap(normalizeWritableEvent)
  return events.length === body.events.length ? { operation: body.operation, events } : null
}

function normalizeWritableEvent(raw: unknown): AppleWritableEvent[] {
  if (!raw || typeof raw !== 'object') return []
  const value = raw as Record<string, unknown>
  const id = shortString(value.id, 400)
  const title = shortString(value.title, 240)
  const start = shortString(value.start, 80)
  const end = shortString(value.end, 80)
  if (!title || !start || !end || Number.isNaN(+new Date(start)) || Number.isNaN(+new Date(end)) || +new Date(end) <= +new Date(start)) return []
  return [{
    id: id || undefined,
    title,
    start,
    end,
    allDay: value.allDay === true,
    noteId: shortString(value.noteId, 200) || undefined,
    description: shortString(value.description, 1000) || undefined,
  }]
}

function shortString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
