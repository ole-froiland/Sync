'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Always light-mode — same token as login page
const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 disabled:opacity-50'

const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

const primaryBtn =
  'w-full flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-60'

function validate(password: string, confirm: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.'
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain at least one special character.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

type Stage = 'exchanging' | 'ready' | 'invalid' | 'success'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('exchanging')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Exchange the PKCE code for a session as soon as the page mounts
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      queueMicrotask(() => {
        setStage('invalid')
      })
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setStage('invalid')
      } else {
        // Remove the code from the URL so a refresh doesn't re-attempt the exchange
        window.history.replaceState(null, '', window.location.pathname)
        setStage('ready')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(password, confirm)
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError(null)
    setSubmitError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setSubmitError(error.message ?? 'Something went wrong. Please try again.')
    } else {
      setStage('success')
      setTimeout(() => router.replace('/login'), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <span className="text-3xl font-semibold tracking-tight text-violet-600">Sync</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_20px_0_rgba(0,0,0,0.07)] p-6">

          {stage === 'exchanging' && (
            <p className="text-sm text-center text-gray-400 py-4">Verifying reset link…</p>
          )}

          {stage === 'invalid' && (
            <div className="space-y-4 text-center">
              <p className="text-base font-semibold text-gray-900">Link expired or invalid</p>
              <p className="text-sm text-gray-400">
                This reset link has already been used or has expired. Request a new one from the login page.
              </p>
              <button
                onClick={() => router.replace('/login')}
                className={primaryBtn}
              >
                Back to log in
              </button>
            </div>
          )}

          {stage === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="text-base font-semibold text-gray-900">Set new password</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Choose a strong password for your account.
                </p>
              </div>

              {/* New password */}
              <div>
                <label htmlFor="new-password" className={labelCls}>New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="At least 10 characters"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setValidationError(null) }}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm-password" className={labelCls}>Confirm password</label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setValidationError(null) }}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Validation / server errors */}
              {(validationError || submitError) && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {validationError ?? submitError}
                </p>
              )}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          {stage === 'success' && (
            <div className="space-y-3 text-center py-2">
              <p className="text-base font-semibold text-gray-900">Password updated</p>
              <p className="text-sm text-gray-400">
                Your password has been changed. Redirecting you to log in…
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
