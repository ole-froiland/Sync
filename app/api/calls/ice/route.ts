import { NextResponse } from 'next/server'
import { fetchMeteredIceServers, IceConfigurationError } from '@/lib/call-ice'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const iceServers = await fetchMeteredIceServers({
      domain: process.env.METERED_DOMAIN,
      apiKey: process.env.METERED_TURN_API_KEY,
    })
    return NextResponse.json(
      { iceServers },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    const status = error instanceof IceConfigurationError ? error.status : 502
    return NextResponse.json(
      { error: 'Secure call relay is unavailable. Please try again shortly.' },
      { status, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
