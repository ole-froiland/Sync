import { createClient } from '@/lib/supabase/server'
import type { CalendarConnectionRow } from './providers/types'

const SKEW_MS = 60_000

const TOKEN_URLS: Record<'google' | 'microsoft', string> = {
  google: 'https://oauth2.googleapis.com/token',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() - Date.now() < SKEW_MS
}

export function buildRefreshRequest(
  provider: 'google' | 'microsoft',
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): { url: string; body: URLSearchParams } {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (provider === 'microsoft') {
    body.set('scope', 'offline_access User.Read Calendars.Read')
  }
  return { url: TOKEN_URLS[provider], body }
}

function clientCredentials(provider: 'google' | 'microsoft') {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    }
  }
  return {
    clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
  }
}

type RefreshResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error_description?: string
  error?: string
}

export async function getValidAccessToken(
  connection: CalendarConnectionRow,
): Promise<string> {
  const provider = connection.provider
  if (provider === 'apple') {
    throw new Error('Apple connections do not use OAuth access tokens')
  }

  if (connection.access_token && !isExpired(connection.expires_at)) {
    return connection.access_token
  }

  if (!connection.refresh_token) {
    if (connection.access_token) return connection.access_token
    throw new Error('No refresh token available; reconnect the calendar')
  }

  const { clientId, clientSecret } = clientCredentials(provider)
  if (!clientId || !clientSecret) {
    throw new Error(`${provider} OAuth is not configured on this server`)
  }

  const { url, body } = buildRefreshRequest(
    provider,
    connection.refresh_token,
    clientId,
    clientSecret,
  )
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as RefreshResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Token refresh failed')
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  const supabase = await createClient()
  const { error: persistError } = await supabase
    .from('calendar_connections')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      status: 'connected',
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    })
    .eq('id', connection.id)
  if (persistError) {
    console.error('Failed to persist refreshed calendar token:', persistError.message)
  }

  return data.access_token
}
