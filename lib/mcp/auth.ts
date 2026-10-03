import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { getSiteUrl } from '@/lib/site-url'

type AuthorizedMcpRequest = {
  supabase: SupabaseClient
  user: User
  authInfo: AuthInfo
}

function mcpResourceUrl(origin?: string) {
  return `${getSiteUrl(origin)}/api/mcp`
}

export function protectedResourceMetadata(origin?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  if (!supabaseUrl) return null

  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    scopes_supported: ['openid', 'email', 'profile'],
    resource_name: 'Sync workspace',
  }
}

function unauthorized(origin?: string) {
  const metadataUrl = `${getSiteUrl(origin)}/.well-known/oauth-protected-resource`
  return new Response(
    JSON.stringify({ error: 'unauthorized', message: 'A valid Sync OAuth access token is required.' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", scope="openid email profile"`,
      },
    }
  )
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return {}
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function authorizeMcpRequest(
  request: Request
): Promise<AuthorizedMcpRequest | Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const origin = new URL(request.url).origin

  if (!supabaseUrl?.startsWith('http') || !anonKey) {
    return Response.json(
      { error: 'mcp_not_configured', message: 'Sync MCP requires Supabase configuration.' },
      { status: 503 }
    )
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return unauthorized(origin)

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) return unauthorized(origin)

  const claims = decodeClaims(token)
  const scope = typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : []

  return {
    supabase,
    user,
    authInfo: {
      token,
      clientId: typeof claims.client_id === 'string' ? claims.client_id : 'sync-mcp-client',
      scopes: scope,
      expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
      resource: new URL(mcpResourceUrl(origin)),
      extra: { userId: user.id },
    },
  }
}
