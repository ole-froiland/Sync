import { protectedResourceMetadata } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const metadata = protectedResourceMetadata(new URL(request.url).origin)
  if (!metadata) {
    return Response.json({ error: 'mcp_not_configured' }, { status: 503 })
  }

  return Response.json(metadata, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}
