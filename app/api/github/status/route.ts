import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false, login: null })
  }

  const { data } = await supabase
    .from('github_connections')
    .select('github_username')
    .eq('user_id', user.id)
    .single()

  // Never return the access token — only the login name is needed client-side
  return NextResponse.json({
    connected: !!data,
    login: data?.github_username ?? null,
  })
}
