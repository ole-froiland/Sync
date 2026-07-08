import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { SyncAssistantAction } from './types'

type AuditStatus = 'planned' | 'confirmed' | 'executed' | 'failed'

export async function logAiAuditEvent(
  supabase: SupabaseClient,
  user: User,
  input: {
    sessionId?: string | null
    action: SyncAssistantAction | null
    status: AuditStatus
    model?: string | null
    error?: string | null
  }
) {
  try {
    await supabase.from('ai_audit_events').insert({
      user_id: user.id,
      session_id: input.sessionId ?? null,
      tool_name: input.action?.kind ?? null,
      status: input.status,
      redacted_args: input.action ? redactAction(input.action) : null,
      model: input.model ?? null,
      error_code: input.error ?? null,
    })
  } catch {
    // The audit migration may not be applied in older local Supabase projects.
  }
}

function redactAction(action: SyncAssistantAction) {
  return JSON.parse(JSON.stringify(action, (key, value) => {
    if (/token|secret|password|authorization|key/i.test(key)) return '[redacted]'
    return value
  })) as Record<string, unknown>
}
