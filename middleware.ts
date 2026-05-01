import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that require an authenticated Supabase session
const PROTECTED_PATHS = ['/dashboard', '/projects', '/chat', '/people', '/settings']

const SUPABASE_CONFIGURED =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export async function middleware(request: NextRequest) {
  // When Supabase is not yet configured (placeholder env vars), skip all auth
  // logic so the app still works in mock mode during local development.
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.next()
  }

  // Build the response that we will eventually return. Supabase SSR needs us
  // to mutate this object so that refreshed session cookies are forwarded to
  // the browser on every response.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies to the outgoing request (so downstream server code sees them)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild the response so cookies are also sent to the browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT and refreshes the session when it is close to
  // expiry. This MUST be called on every middleware run — do not short-circuit
  // before this line or the session will silently expire.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect authenticated users away from the login page
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Guard all app routes — redirect unauthenticated users to /login
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Return supabaseResponse (not NextResponse.next()) so that the updated
  // session cookies are included in the response headers.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes except:
     * - Next.js internals (_next/static, _next/image)
     * - favicon.ico and common static file extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
