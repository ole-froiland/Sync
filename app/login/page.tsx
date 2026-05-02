'use client'

import { useActionState, useEffect, useState } from 'react'
import { LogIn, UserPlus, Zap, Eye, EyeOff } from 'lucide-react'
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
  // Read error from URL once on mount — lazy initializer avoids setState-in-effect
  const [oauthError, setOauthError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const errKey = new URLSearchParams(window.location.search).get('error') ?? ''
    return errKey ? (oauthErrors[errKey] ?? 'An error occurred. Please try again.') : null
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null)

  // Clean the error query param from the URL without triggering a re-render
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
    // On success the browser navigates away — leave loading=true
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Sync
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Private workspace for builders.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setTab('signup')}
              className={`py-3 text-sm font-medium transition-colors focus:outline-none ${
                tab === 'signup'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <UserPlus size={15} />
                Sign me up
              </span>
            </button>
            <button
              onClick={() => setTab('login')}
              className={`py-3 text-sm font-medium transition-colors focus:outline-none ${
                tab === 'login'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <LogIn size={15} />
                Log in
              </span>
            </button>
          </div>

          <div className="p-6">
            {tab === 'signup' ? (
              /* ── Sign-up panel ── */
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New here? Create your account with GitHub — it only takes a moment.
                </p>
                <Button
                  onClick={signUpWithGitHub}
                  loading={oauthLoading}
                  variant="primary"
                  size="lg"
                  className="w-full justify-center gap-3"
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
                  {oauthLoading ? 'Redirecting to GitHub…' : 'Sign up with GitHub'}
                </Button>
                {oauthError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                    {oauthError}
                  </p>
                )}
              </div>
            ) : (
              /* ── Log-in panel ── */
              <form action={loginFormAction} className="space-y-4">
                <Input
                  id="identifier"
                  name="identifier"
                  label="Email or username"
                  placeholder="ada@example.com or adalovelace"
                  autoComplete="username"
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
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
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {loginState?.error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                    {loginState.error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  loading={loginPending}
                  disabled={loginPending}
                >
                  {loginPending ? 'Signing in…' : 'Log in'}
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Secure authentication powered by Supabase.
        </p>
      </div>
    </div>
  )
}
