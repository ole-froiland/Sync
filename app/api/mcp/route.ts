import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authorizeMcpRequest } from '@/lib/mcp/auth'
import { SupabaseSyncMcpRepository } from '@/lib/mcp/repository'
import { createSyncMcpServer } from '@/lib/mcp/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate',
}

function withCors(response: Response) {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value)
  }
  return response
}

async function handleMcpRequest(request: Request) {
  const authorized = await authorizeMcpRequest(request)
  if (authorized instanceof Response) return withCors(authorized)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  const repository = new SupabaseSyncMcpRepository(authorized.supabase, authorized.user.id)
  const server = createSyncMcpServer(repository)

  await server.connect(transport)
  const response = await transport.handleRequest(request, {
    authInfo: authorized.authInfo,
  })
  return withCors(response)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const GET = handleMcpRequest
export const POST = handleMcpRequest
export const DELETE = handleMcpRequest
