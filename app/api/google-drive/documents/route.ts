import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/calendar/token'
import type { CalendarConnectionRow } from '@/lib/calendar/providers/types'
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  googleDriveDocumentConfig,
  isGoogleDriveDocumentType,
} from '@/lib/google-drive-documents'

type GoogleDriveFileResponse = {
  id?: string
  error?: { message?: string }
}

function hasDriveFileScope(scope: string | null) {
  return scope?.split(/\s+/).includes(GOOGLE_DRIVE_FILE_SCOPE) ?? false
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const type = typeof body?.type === 'string' ? body.type : ''
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''

  if (!isGoogleDriveDocumentType(type)) {
    return NextResponse.json({ error: 'Unsupported Google document type.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connection, error: connectionError } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle()

  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 })
  if (!connection || !hasDriveFileScope(connection.scope)) {
    return NextResponse.json(
      { error: 'Koble til Google på nytt i Kalender for å opprette lagrede dokumenter.' },
      { status: 409 }
    )
  }

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(connection as CalendarConnectionRow)
  } catch {
    return NextResponse.json(
      { error: 'Google-tilkoblingen må kobles til på nytt før du kan opprette dokumenter.' },
      { status: 409 }
    )
  }

  const config = googleDriveDocumentConfig(type)
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title || (type === 'docs' ? 'Nytt Google-dokument' : 'Nytt Google-regneark'),
      mimeType: config.mimeType,
    }),
  })
  const data = (await response.json().catch(() => null)) as GoogleDriveFileResponse | null

  if (!response.ok || !data?.id) {
    const message = response.status === 401 || response.status === 403
      ? 'Google-tilkoblingen må kobles til på nytt før du kan opprette dokumenter.'
      : data?.error?.message ?? 'Kunne ikke opprette dokumentet i Google Drive.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ url: config.editUrl(data.id) }, { status: 201 })
}
