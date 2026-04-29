import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await request.json()
  const { data, error } = await supabase
    .from('invites')
    .insert({ email, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/login?invite=${data.token}`
  // TODO: send invite email via Resend or SendGrid: await sendInviteEmail(email, inviteUrl)

  return NextResponse.json({ ...data, invite_url: inviteUrl })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('invites')
    .select('*, created_by_profile:profiles(name, email)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
