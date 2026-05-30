import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as google from '@/lib/calendar/providers/google'
import * as microsoft from '@/lib/calendar/providers/microsoft'
import * as apple from '@/lib/calendar/providers/apple'
import type {
  CalendarConnectionRow,
  CalendarProvider,
  ExternalEvent,
} from '@/lib/calendar/providers/types'

const adapters: Record<
  CalendarProvider,
  (c: CalendarConnectionRow, s: Date, e: Date) => Promise<ExternalEvent[]>
> = {
  google: google.fetchEvents,
  microsoft: microsoft.fetchEvents,
  apple: apple.fetchEvents,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
  }

  const rangeStart = new Date(startParam)
  const rangeEnd = new Date(endParam)
  if (Number.isNaN(+rangeStart) || Number.isNaN(+rangeEnd)) {
    return NextResponse.json({ error: 'Invalid start or end' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events: ExternalEvent[] = []
  const providerErrors: { provider: string; message: string }[] = []

  await Promise.all(
    (connections ?? []).map(async (connection: CalendarConnectionRow) => {
      const adapter = adapters[connection.provider]
      if (!adapter) return
      try {
        const result = await adapter(connection, rangeStart, rangeEnd)
        events.push(...result)
      } catch (caught) {
        providerErrors.push({
          provider: connection.provider,
          message: caught instanceof Error ? caught.message : 'Fetch failed',
        })
        await supabase
          .from('calendar_connections')
          .update({ status: 'error' })
          .eq('id', connection.id)
      }
    }),
  )

  return NextResponse.json({ events, providerErrors })
}
