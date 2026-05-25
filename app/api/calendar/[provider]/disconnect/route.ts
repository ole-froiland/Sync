import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const providers = new Set(['apple', 'microsoft', 'google'])

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  if (!providers.has(provider)) {
    return NextResponse.json({ error: 'Unknown calendar provider' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
