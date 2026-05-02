import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const GITHUB_CONNECT_CLIENT_ID = process.env.GITHUB_CONNECT_CLIENT_ID
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!GITHUB_CONNECT_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GITHUB_CONNECT_CLIENT_ID is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  // CSRF protection: random state stored in an httpOnly cookie
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: GITHUB_CONNECT_CLIENT_ID,
    redirect_uri: `https://froiland.netlify.app/api/github/callback`,
    scope: 'repo',
    state,
  })

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  )
}
