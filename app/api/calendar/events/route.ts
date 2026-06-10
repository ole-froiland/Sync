import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gatherExternalEvents, type FetchEvents } from '@/lib/calendar/gather-events'
import type { CalendarProvider } from '@/lib/calendar/providers/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Adapters are imported lazily so the build's page-data collection does not
// evaluate their heavy CalDAV/ICS dependencies (tsdav, node-ical).
async function getAdapter(provider: CalendarProvider): Promise<FetchEvents | null> {
  switch (provider) {
    case 'google':
      return (await import('@/lib/calendar/providers/google')).fetchEvents
    case 'microsoft':
      return (await import('@/lib/calendar/providers/microsoft')).fetchEvents
    case 'apple':
      return (await import('@/lib/calendar/providers/apple')).fetchEvents
    default:
      return null
  }
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

  const { events, providerErrors, failedConnectionIds } = await gatherExternalEvents(
    connections ?? [],
    getAdapter,
    rangeStart,
    rangeEnd,
  )

  const failed = new Set(failedConnectionIds)
  const recoveredIds = (connections ?? [])
    .filter((c) => c.status === 'error' && !failed.has(c.id))
    .map((c) => c.id)

  await Promise.all([
    failedConnectionIds.length > 0
      ? supabase
          .from('calendar_connections')
          .update({ status: 'error' })
          .in('id', failedConnectionIds)
      : null,
    recoveredIds.length > 0
      ? supabase
          .from('calendar_connections')
          .update({ status: 'connected' })
          .in('id', recoveredIds)
      : null,
  ])

  return NextResponse.json({ events, providerErrors })
}
