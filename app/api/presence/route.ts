import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lastActiveAt = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({ last_active_at: lastActiveAt })
    .eq('id', user.id)

  if (error) {
    const isMigrationPending =
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      error.message.includes('last_active_at')

    if (!isMigrationPending) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      user_id: user.id,
      last_active_at: lastActiveAt,
      persisted: false,
    })
  }

  return NextResponse.json({
    user_id: user.id,
    last_active_at: lastActiveAt,
    persisted: true,
  })
}
