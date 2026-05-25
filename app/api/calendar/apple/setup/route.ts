import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AppleSetupBody = {
  username?: string
  appPassword?: string
  serverUrl?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as AppleSetupBody
  const username = body.username?.trim()
  const appPassword = body.appPassword?.trim()
  const serverUrl = body.serverUrl?.trim() || 'https://caldav.icloud.com'

  if (!username || !appPassword) {
    return NextResponse.json(
      { error: 'Apple ID and app-specific password are required.' },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: user.id,
      provider: 'apple',
      provider_account_name: username,
      provider_email: username.includes('@') ? username : null,
      caldav_username: username,
      caldav_app_password: appPassword,
      caldav_server_url: serverUrl,
      status: 'connected',
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
