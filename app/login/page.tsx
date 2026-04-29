'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [email, setEmail] = useState('')

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault()
    // Future integration: send request access email / store in DB
    setRequestSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Private workspace for builders</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sync is invite-only. You need a valid invite to access the workspace.
            </p>
          </div>

          <Button
            onClick={signInWithGoogle}
            loading={loading}
            variant="secondary"
            className="w-full justify-center gap-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-4">
              Don&apos;t have an invite?
            </p>
            {requestSent ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-2 text-sm">
                  <span>✓</span> Request sent — we&apos;ll be in touch.
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestAccess} className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button type="submit" variant="ghost" size="sm" className="border border-gray-200">
                  Request
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in you agree to use this responsibly.
        </p>
      </div>
    </div>
  )
}
