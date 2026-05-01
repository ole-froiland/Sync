import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { LOCAL_GITHUB_SESSION_COOKIE } from '@/lib/local-github-session'

async function signOut() {
  const cookieStore = await cookies()
  cookieStore.set(LOCAL_GITHUB_SESSION_COOKIE, '', { maxAge: 0, path: '/' })
  cookieStore.set('github_login_state', '', { maxAge: 0, path: '/' })

  if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
}

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  try {
    await signOut()
  } finally {
    return NextResponse.redirect(`${origin}/login`)
  }
}
