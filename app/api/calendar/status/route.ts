import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const providers = ['apple', 'microsoft', 'google'] as const

type Provider = (typeof providers)[number]

function providerConfigured(provider: Provider) {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
  }
  if (provider === 'microsoft') {
    return Boolean(process.env.MICROSOFT_CALENDAR_CLIENT_ID && process.env.MICROSOFT_CALENDAR_CLIENT_SECRET)
  }
  return true
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('provider, provider_account_name, provider_email, caldav_username, status, updated_at')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byProvider = new Map((data ?? []).map((row) => [row.provider as Provider, row]))

  return NextResponse.json({
    providers: providers.map((provider) => {
      const row = byProvider.get(provider)
      return {
        provider,
        configured: providerConfigured(provider),
        connected: Boolean(row),
        account:
          row?.provider_email ??
          row?.provider_account_name ??
          row?.caldav_username ??
          null,
        status: row?.status ?? null,
        updatedAt: row?.updated_at ?? null,
      }
    }),
  })
}
