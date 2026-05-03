'use client'

import { useActionState, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loginAction } from './actions'

const oauthErrors: Record<string, string> = {
  auth_failed: 'GitHub login failed. Please try again.',
}

// Shared primitive styles — always light mode, no dark: variants
const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 disabled:opacity-50'

const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

const primaryBtn =
  'w-full flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-60'

export default function LoginPage() {
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  const [forgotView, setForgotView] = useState(false)

  // GitHub OAuth state
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const key = new URLSearchParams(window.location.search).get('error') ?? ''
    return key ? (oauthErrors[key] ?? 'An error occurred. Please try again.') : null
  })

  // Login form state
  const [showPassword, setShowPassword] = useState(false)
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null)

  // Forgot-password state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('error')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Reset forgot-password state when switching tabs or closing the view
  function openForgot() {
    setForgotEmail('')
    setForgotSuccess(false)
    setForgotError(null)
    setForgotView(true)
  }

  function closeForgot() {
    setForgotView(false)
  }

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

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault()
    if (forgotLoading) return
    setForgotLoading(true)
    setForgotError(null)
    const supabase = createClient()
    const redirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) + '/auth/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo })
    setForgotLoading(false)
    if (error) {
      setForgotError('Something went wrong. Please try again.')
    } else {
      setForgotSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <span className="text-3xl font-semibold tracking-tight text-violet-600">Sync</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_20px_0_rgba(0,0,0,0.07)] overflow-hidden">

          {/* ── Forgot-password view ── */}
          {forgotView ? (
            <div className="p-6 space-y-5">
              <div>
                <button
                  onClick={closeForgot}
                  className="text-xs text-gray-400 hover:text-violet-600 transition-colors mb-4 flex items-center gap-1"
                >
                  ← Back to log in
                </button>
                <h2 className="text-base font-semibold text-gray-900">Reset your password</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              {forgotSuccess ? (
                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Check your email for a password reset link.
                </div>
              ) : (
                <form onSubmit={sendResetLink} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className={labelCls}>Email</label>
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="ada@example.com"
                      required
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {forgotError && (
                    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {forgotError}
                    </p>
                  )}
                  <button type="submit" disabled={forgotLoading} className={primaryBtn}>
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* ── Tabs ── */}
              <div className="grid grid-cols-2 border-b border-gray-100">
                {(['signup', 'login'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`py-3.5 text-sm font-medium transition-colors focus:outline-none ${
                      tab === t
                        ? 'text-violet-600 border-b-2 border-violet-500'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {t === 'signup' ? 'Sign up' : 'Log in'}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {tab === 'signup' ? (
                  /* ── Sign-up panel ── */
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      Create your account with GitHub — it only takes a moment.
                    </p>
                    <button
                      onClick={signUpWithGitHub}
                      disabled={oauthLoading}
                      className={primaryBtn}
                    >
                      {!oauthLoading && (
                        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                  /* ── Log-in panel ── */
                  <form action={loginFormAction} className="space-y-4">
                    <div>
                      <label htmlFor="identifier" className={labelCls}>Email or username</label>
                      <input
                        id="identifier"
                        name="identifier"
                        type="text"
                        placeholder="ada@example.com"
                        autoComplete="username"
                        required
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="password" className={labelCls.replace('mb-1.5', '')}>
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={openForgot}
                          className="text-xs text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Your password"
                          required
                          autoComplete="current-password"
                          className={inputCls + ' pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                      className={primaryBtn}
                    >
                      {loginPending ? 'Signing in…' : 'Log in'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
