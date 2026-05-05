'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PersonCardSkeleton } from '@/components/ui/Skeleton'
import { mockProfiles, mockProjects } from '@/lib/mock-data'
import type { Profile, Project } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

const TOOL_COLORS: Record<string, string> = {
  Claude: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Cursor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  GitHub: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Figma: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Codex: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'VS Code': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  ChatGPT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Copilot: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

type ConnectionState = 'none' | 'following' | 'pending' | 'synced'
type ConnectionMap = Record<string, ConnectionState>
type Toast = { id: number; tone: 'success' | 'error'; message: string }

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [connections, setConnections] = useState<ConnectionMap>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pendingByUser, setPendingByUser] = useState<Record<string, 'follow' | 'sync' | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      if (!SUPABASE_CONFIGURED) {
        if (cancelled) return
        setProfiles(mockProfiles)
        setProjects(mockProjects)
        setConnections({})
        setCurrentUserId('mock-current-user')
        setLoading(false)
        return
      }

      try {
        const [peopleRes, projectsRes, connectionsRes] = await Promise.all([
          fetch('/api/people'),
          fetch('/api/projects'),
          fetch('/api/connections'),
        ])

        if (!peopleRes.ok) throw new Error('Failed to load people')
        const people = (await peopleRes.json()) as Profile[] | { error: string }
        const projs = projectsRes.ok ? ((await projectsRes.json()) as Project[]) : []
        const connData = connectionsRes.ok
          ? ((await connectionsRes.json()) as { userId: string; connections: ConnectionMap })
          : { userId: null, connections: {} }

        if (cancelled) return
        setProfiles(Array.isArray(people) ? people : [])
        setProjects(Array.isArray(projs) ? projs : [])
        setConnections(connData.connections ?? {})
        setCurrentUserId(connData.userId ?? null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Something went wrong loading people.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleProfiles = useMemo(
    () => profiles.filter((p) => p.id !== currentUserId),
    [profiles, currentUserId]
  )

  function getProjectsForUser(userId: string) {
    return projects.filter((p) =>
      p.members?.some(
        (m) =>
          (m as unknown as { id?: string; user_id?: string }).id === userId ||
          (m as unknown as { id?: string; user_id?: string }).user_id === userId
      )
    )
  }

  const setConnectionState = useCallback((userId: string, state: ConnectionState) => {
    setConnections((prev) => {
      const next = { ...prev }
      if (state === 'none') delete next[userId]
      else next[userId] = state
      return next
    })
  }, [])

  const setBusy = useCallback((userId: string, action: 'follow' | 'sync' | null) => {
    setPendingByUser((prev) => ({ ...prev, [userId]: action }))
  }, [])

  const handleFollow = useCallback(
    async (profile: Profile) => {
      const current = connections[profile.id] ?? 'none'
      const isFollowing = current === 'following'
      const next: ConnectionState = isFollowing ? 'none' : 'following'

      setBusy(profile.id, 'follow')
      setConnectionState(profile.id, next)

      if (!SUPABASE_CONFIGURED) {
        showToast(isFollowing ? `Unfollowed ${profile.name}` : `Following ${profile.name}`)
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/follow`, {
          method: isFollowing ? 'DELETE' : 'POST',
        })
        if (!res.ok) throw new Error('Request failed')
        showToast(isFollowing ? `Unfollowed ${profile.name}` : `Following ${profile.name}`)
      } catch {
        setConnectionState(profile.id, current)
        showToast('Could not update follow. Try again.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [connections, setBusy, setConnectionState, showToast]
  )

  const handleSync = useCallback(
    async (profile: Profile) => {
      const current = connections[profile.id] ?? 'none'
      const isActive = current === 'pending' || current === 'synced'
      const optimisticNext: ConnectionState = isActive ? 'none' : 'pending'

      setBusy(profile.id, 'sync')
      setConnectionState(profile.id, optimisticNext)

      if (!SUPABASE_CONFIGURED) {
        showToast(
          isActive
            ? current === 'synced'
              ? `Removed Sync with ${profile.name}`
              : `Sync request to ${profile.name} cancelled`
            : `Sync request sent to ${profile.name}`
        )
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/sync`, {
          method: isActive ? 'DELETE' : 'POST',
        })
        if (!res.ok) throw new Error('Request failed')
        const body = (await res.json().catch(() => ({}))) as { status?: ConnectionState }
        if (!isActive && body.status) {
          setConnectionState(profile.id, body.status)
          showToast(
            body.status === 'synced'
              ? `Synced with ${profile.name}`
              : `Sync request sent to ${profile.name}`
          )
        } else {
          showToast(
            current === 'synced'
              ? `Removed Sync with ${profile.name}`
              : `Sync request cancelled`
          )
        }
      } catch {
        setConnectionState(profile.id, current)
        showToast('Could not update Sync. Try again.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [connections, setBusy, setConnectionState, showToast]
  )

  return (
    <>
      <TopBar title="People" />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : visibleProfiles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProfiles.map((profile) => {
              const userProjects = getProjectsForUser(profile.id)
              const state = connections[profile.id] ?? 'none'
              const busy = pendingByUser[profile.id] ?? null
              return (
                <PersonCard
                  key={profile.id}
                  profile={profile}
                  projects={userProjects}
                  state={state}
                  busy={busy}
                  onFollow={() => handleFollow(profile)}
                  onSync={() => handleSync(profile)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-lg border backdrop-blur-sm transition-all ${
              t.tone === 'success'
                ? 'bg-gray-900/95 dark:bg-gray-100/95 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
                : 'bg-red-600/95 text-white border-red-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}

function PersonCard({
  profile,
  projects,
  state,
  busy,
  onFollow,
  onSync,
}: {
  profile: Profile
  projects: Project[]
  state: ConnectionState
  busy: 'follow' | 'sync' | null
  onFollow: () => void
  onSync: () => void
}) {
  const followLabel = state === 'following' ? 'Following' : 'Follow'
  const syncLabel =
    state === 'synced' ? 'Synced' : state === 'pending' ? 'Pending' : 'Sync'

  const followClassName =
    state === 'following'
      ? 'border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30'
      : ''

  const syncClassName =
    state === 'synced'
      ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white'
      : state === 'pending'
        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50'
        : ''

  return (
    <Card
      padding="md"
      className="flex flex-col gap-4 hover:border-purple-200 dark:hover:border-purple-800/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar name={profile.name} src={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {profile.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {profile.role ?? 'Member'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{profile.email}</p>
        </div>
        <div className="flex flex-col gap-1.5 items-stretch shrink-0">
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'follow'}
            disabled={busy !== null}
            onClick={onFollow}
            className={followClassName}
          >
            {followLabel}
          </Button>
          {state === 'synced' ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                loading={busy === 'sync'}
                disabled={busy !== null}
                onClick={onSync}
                className={syncClassName}
              >
                {syncLabel}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null}>
                Message
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant={state === 'pending' ? 'secondary' : 'primary'}
              loading={busy === 'sync'}
              disabled={busy !== null}
              onClick={onSync}
              className={syncClassName}
            >
              {syncLabel}
            </Button>
          )}
        </div>
      </div>

      {profile.tools_used && profile.tools_used.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
            Tools
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.tools_used.map((tool) => (
              <Badge
                key={tool}
                className={
                  TOOL_COLORS[tool] ??
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }
              >
                {tool}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
            Projects
          </p>
          <div className="flex flex-col gap-1">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
          Activity
        </p>
        <ActivityBars seed={profile.id} />
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Last 2 weeks</p>
      </div>
    </Card>
  )
}

function ActivityBars({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    const state = { h: 0 }
    for (let i = 0; i < seed.length; i++) {
      state.h = (state.h * 31 + seed.charCodeAt(i)) >>> 0
    }
    return Array.from({ length: 14 }, () => {
      state.h = (state.h * 1664525 + 1013904223) >>> 0
      const r = (state.h & 0xffff) / 0xffff
      state.h = (state.h * 1664525 + 1013904223) >>> 0
      const intensity = (state.h & 0xffff) / 0xffff
      return r > 0.45 ? 0.25 + intensity * 0.6 : 0
    })
  }, [seed])

  return (
    <div className="flex gap-1">
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 h-2 rounded-sm"
          style={{
            backgroundColor:
              v > 0 ? `rgba(168, 85, 247, ${0.25 + v * 0.6})` : 'rgba(168, 85, 247, 0.08)',
          }}
        />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">No one here yet</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
        Invite teammates or wait for new builders to join the workspace. They&apos;ll show up here
        once they&apos;re onboarded.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Couldn&apos;t load people
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{message}</p>
      <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
