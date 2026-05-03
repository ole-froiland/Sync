'use client'

import { useActionState, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { loginAction } from './actions'

const oauthErrors: Record<string, string> = {
  auth_failed: 'GitHub login failed. Please try again.',
}

export default function LoginPage() {
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const errKey = new URLSearchParams(window.location.search).get('error') ?? ''
    return errKey ? (oauthErrors[errKey] ?? 'An error occurred. Please try again.') : null
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('error')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function signUpWithGitHub() {
    if (oauthLoading) return
    setOauthLoading(true)
    setOauthError(null)
    const supabase = createClient()
    const redirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) + '/auth/callback'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    })
    if (error) {
      setOauthError('GitHub signup failed. Please try again.')
      setOauthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <span className="text-3xl font-semibold tracking-tight text-violet-600">
            Sync
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-100">
            <button
              onClick={() => setTab('signup')}
              className={`py-3.5 text-sm font-medium transition-colors focus:outline-none ${
                tab === 'signup'
                  ? 'text-violet-600 border-b-2 border-violet-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign up
            </button>
            <button
              onClick={() => setTab('login')}
              className={`py-3.5 text-sm font-medium transition-colors focus:outline-none ${
                tab === 'login'
                  ? 'text-violet-600 border-b-2 border-violet-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Log in
            </button>
          </div>

          <div className="p-6">
            {tab === 'signup' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Create your account with GitHub — it only takes a moment.
                </p>
                <button
                  onClick={signUpWithGitHub}
                  disabled={oauthLoading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-60"
                >
                  {!oauthLoading && (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  )}
                  {oauthLoading ? 'Redirecting…' : 'Continue with GitHub'}
                </button>
                {oauthError && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {oauthError}
                  </p>
                )}
              </div>
            ) : (
              <form action={loginFormAction} className="space-y-4">
                <Input
                  id="identifier"
                  name="identifier"
                  label="Email or username"
                  placeholder="ada@example.com"
                  autoComplete="username"
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Your password"
                      required
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {loginState?.error && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {loginState.error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loginPending}
                  className="w-full flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-60"
                >
                  {loginPending ? 'Signing in…' : 'Log in'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
