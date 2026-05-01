'use client'

import { useEffect, useState } from 'react'
import { LogIn, ShieldCheck, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'

const loginErrors: Record<string, string> = {
  auth_failed: 'GitHub login failed. Please try again.',
  github_denied: 'GitHub authorization was cancelled.',
  github_invalid_state: 'GitHub login expired. Please try again.',
  github_missing_params: 'GitHub did not return the expected login details.',
  github_not_configured:
    'GitHub login needs GitHub OAuth app values in the site environment.',
  github_profile_failed: 'Could not fetch your GitHub profile. Please try again.',
  github_token_failed: 'Could not finish GitHub login. Please check the GitHub configuration.',
}

export default function LoginPage() {
  const initialError =
    typeof window === 'undefined'
      ? null
      : loginErrors[new URLSearchParams(window.location.search).get('error') ?? ''] ?? null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function signInWithGitHub() {
    setLoading(true)
    setError(null)
    window.location.assign('/auth/github')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Private workspace for builders.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-indigo-700 mb-3">
              <ShieldCheck size={17} />
              <span className="text-sm font-medium">Invite-only access</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Log in to Sync</h2>
            <p className="text-sm text-gray-500 mt-1">
              Use the GitHub account connected to your workspace invite.
            </p>
          </div>

          <Button
            onClick={signInWithGitHub}
            loading={loading}
            variant="primary"
            size="lg"
            className="w-full justify-center gap-3"
          >
            {!loading && (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            )}
            {loading ? 'Opening GitHub...' : 'Continue with GitHub'}
          </Button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-gray-100 pt-5 text-xs text-gray-500">
            <LogIn size={14} />
            Secure authentication by GitHub OAuth.
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Access is limited to approved workspace members.
        </p>
      </div>
    </div>
  )
}
