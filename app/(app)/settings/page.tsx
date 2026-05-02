'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useUser } from '@/context/UserContext'
import { useGitHub } from '@/context/GitHubContext'
import { GitBranch, CheckCircle, AlertCircle, X } from 'lucide-react'

const TOOL_OPTIONS = [
  'Claude', 'Cursor', 'GitHub', 'Figma', 'Codex',
  'VS Code', 'ChatGPT', 'Copilot', 'Vercel', 'Linear',
]

const GITHUB_ERROR_MESSAGES: Record<string, string> = {
  denied: 'GitHub authorization was cancelled.',
  missing_params: 'GitHub returned an unexpected response.',
  invalid_state: 'OAuth state mismatch — please try again.',
  not_configured: 'GitHub OAuth is not configured on this server.',
  token_failed: 'Failed to exchange GitHub authorization code for a token.',
  save_failed: 'Token was received but could not be saved. Check Supabase table and RLS policies.',
}

export default function SettingsPage() {
  const profile = useUser()
  const github = useGitHub()

  const [name, setName] = useState(profile?.name ?? '')
  const [role, setRole] = useState(profile?.role ?? '')
  const [tools, setTools] = useState<string[]>(profile?.tools_used ?? [])
  const [saved, setSaved] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Read URL params once on mount to set the initial flash — no useEffect setState needed
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_connected')) {
      return { type: 'success', message: 'GitHub connected successfully!' }
    }
    if (params.get('github_error')) {
      const code = params.get('github_error') ?? 'unknown'
      const detail = params.get('detail')
      const base = GITHUB_ERROR_MESSAGES[code] ?? 'GitHub connection failed. Please try again.'
      return { type: 'error', message: detail ? `${base} (${decodeURIComponent(detail)})` : base }
    }
    return null
  })

  // Side effects only: clean URL + refresh context (no setState here)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_connected') || params.get('github_error')) {
      window.history.replaceState({}, '', '/settings')
    }
    if (params.get('github_connected')) {
      github.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ name, role: role || null, tools_used: tools })
        .eq('id', profile.id)
    } catch {}

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDisconnectGitHub() {
    setDisconnecting(true)
    try {
      await fetch('/api/github/disconnect', { method: 'DELETE' })
      await github.refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">

        {/* Flash message */}
        {flash && (
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm ${
              flash.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
            }`}
          >
            {flash.type === 'success' ? (
              <CheckCircle size={15} className="flex-shrink-0" />
            ) : (
              <AlertCircle size={15} className="flex-shrink-0" />
            )}
            <span className="flex-1">{flash.message}</span>
            <button onClick={() => setFlash(null)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h2>
            <div className="flex items-center gap-4 mb-5">
              <Avatar name={name || 'User'} src={profile?.avatar_url} size="lg" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name || 'User'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{profile?.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Input
                label="Role / title"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Full-stack developer"
              />
            </div>
          </Card>

          {/* Connected accounts */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Connected accounts
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Manage third-party integrations. Tokens are stored server-side only.
            </p>

            {/* GitHub login — always connected (it's how you log in) */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-gray-100 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white dark:text-gray-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">GitHub</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{profile?.email}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                Connected
              </span>
            </div>

            {/* GitHub API — for repository creation */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-gray-100 flex items-center justify-center">
                  <GitBranch size={14} className="text-white dark:text-gray-900" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    GitHub Repositories
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {github.connected && github.login
                      ? `@${github.login}`
                      : 'Not connected — required for repository access'}
                  </p>
                </div>
              </div>
              {github.connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                    Connected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGitHub}
                    loading={disconnecting}
                    className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <a href="/api/github/connect">
                  <Button type="button" variant="secondary" size="sm">
                    <GitBranch size={13} />
                    Connect
                  </Button>
                </a>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Tools I use
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              These show on your profile and help teammates find collaborators.
            </p>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    tools.includes(tool)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p
              className={`text-sm transition-opacity ${
                saved ? 'text-emerald-600 dark:text-emerald-400 opacity-100' : 'opacity-0'
              }`}
            >
              ✓ Saved
            </p>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </div>
    </>
  )
}
