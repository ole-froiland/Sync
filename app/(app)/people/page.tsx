'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { PersonCardSkeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
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

type SyncState = 'none' | 'pending' | 'request_received' | 'synced'
type SyncMap = Record<string, SyncState>
type FollowSet = Record<string, true>
type Toast = { id: number; tone: 'success' | 'error'; message: string }
type SyncBusyAction = 'sync' | 'accept' | 'reject'
type UsageStats = {
  codex: {
    requests: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    remainingPercent: number
    resetLabel: string
    lastActiveLabel: string
    mostUsedModel: string
  }
  dailyCodex: Array<{
    label: string
    dateLabel: string
    requests: number
    tokens: number
    limitTokens: number
    status: 'normal' | 'heavy' | 'used_up'
  }>
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

export default function PeoplePage() {
  const currentUser = useUser()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [follows, setFollows] = useState<FollowSet>({})
  const [syncStates, setSyncStates] = useState<SyncMap>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pendingByUser, setPendingByUser] = useState<Record<string, 'follow' | SyncBusyAction | null>>({})
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
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
        setFollows({})
        setSyncStates({})
        setCurrentUserId(currentUser?.id ?? 'mock-current-user')
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
          ? ((await connectionsRes.json()) as {
              userId: string
              follows?: string[]
              sync?: SyncMap
            })
          : { userId: null, follows: [], sync: {} as SyncMap }

        if (cancelled) return
        setProfiles(Array.isArray(people) ? people : [])
        setProjects(Array.isArray(projs) ? projs : [])
        const followSet: FollowSet = {}
        for (const id of connData.follows ?? []) followSet[id] = true
        setFollows(followSet)
        setSyncStates(connData.sync ?? {})
        setCurrentUserId(connData.userId ?? currentUser?.id ?? null)
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
  }, [currentUser])

  const effectiveCurrentUserId = currentUserId ?? currentUser?.id ?? null

  const currentProfile = useMemo(() => {
    const fromList = profiles.find((p) => p.id === effectiveCurrentUserId)
    if (fromList) return fromList
    if (currentUser) return currentUser
    if (effectiveCurrentUserId) return buildFallbackCurrentProfile(effectiveCurrentUserId)
    return null
  }, [profiles, effectiveCurrentUserId, currentUser])

  const visibleProfiles = useMemo(() => {
    const others = profiles.filter((p) => p.id !== currentProfile?.id)
    return currentProfile ? [currentProfile, ...others] : others
  }, [profiles, currentProfile])

  const selectedProfile = useMemo(
    () => visibleProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [visibleProfiles, selectedProfileId]
  )

  const usageStats = useMemo(
    () => (currentProfile ? buildUsageStats(currentProfile) : null),
    [currentProfile]
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

  const setFollow = useCallback((userId: string, isFollowing: boolean) => {
    setFollows((prev) => {
      const next = { ...prev }
      if (isFollowing) next[userId] = true
      else delete next[userId]
      return next
    })
  }, [])

  const setSyncState = useCallback((userId: string, state: SyncState) => {
    setSyncStates((prev) => {
      const next = { ...prev }
      if (state === 'none') delete next[userId]
      else next[userId] = state
      return next
    })
  }, [])

  const setBusy = useCallback((userId: string, action: 'follow' | SyncBusyAction | null) => {
    setPendingByUser((prev) => ({ ...prev, [userId]: action }))
  }, [])

  const handleFollow = useCallback(
    async (profile: Profile) => {
      const wasFollowing = !!follows[profile.id]
      const next = !wasFollowing

      setBusy(profile.id, 'follow')
      setFollow(profile.id, next)

      if (!SUPABASE_CONFIGURED) {
        showToast(wasFollowing ? 'Unfollowed' : 'Following')
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/follow`, {
          method: wasFollowing ? 'DELETE' : 'POST',
        })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not update follow.')
          throw new Error(message)
        }
        showToast(wasFollowing ? 'Unfollowed' : 'Following')
      } catch (e) {
        setFollow(profile.id, wasFollowing)
        showToast(e instanceof Error ? e.message : 'Could not update follow.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [follows, setBusy, setFollow, showToast]
  )

  const handleSync = useCallback(
    async (profile: Profile) => {
      const current = syncStates[profile.id] ?? 'none'
      const isActive = current === 'pending' || current === 'synced'
      const optimisticNext: SyncState = isActive ? 'none' : 'pending'

      setBusy(profile.id, 'sync')
      setSyncState(profile.id, optimisticNext)

      if (!SUPABASE_CONFIGURED) {
        showToast(isActive ? 'Sync request cancelled' : 'Sync request sent')
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/sync`, {
          method: isActive ? 'DELETE' : 'POST',
        })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not update Sync.')
          throw new Error(message)
        }
        const body = (await res.json().catch(() => ({}))) as { status?: SyncState }
        if (!isActive && body.status) {
          setSyncState(profile.id, body.status)
          showToast(body.status === 'synced' ? 'Sync accepted' : 'Sync request sent')
        } else {
          showToast(current === 'synced' ? 'Sync removed' : 'Sync request cancelled')
        }
      } catch (e) {
        setSyncState(profile.id, current)
        showToast(e instanceof Error ? e.message : 'Could not update Sync.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [syncStates, setBusy, setSyncState, showToast]
  )

  const handleAccept = useCallback(
    async (profile: Profile) => {
      setBusy(profile.id, 'accept')
      setSyncState(profile.id, 'synced')
      try {
        const res = await fetch(`/api/people/${profile.id}/sync/accept`, { method: 'POST' })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not accept Sync.')
          throw new Error(message)
        }
        showToast('Sync accepted')
      } catch (e) {
        setSyncState(profile.id, 'request_received')
        showToast(e instanceof Error ? e.message : 'Could not accept Sync.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [setBusy, setSyncState, showToast]
  )

  const handleReject = useCallback(
    async (profile: Profile) => {
      setBusy(profile.id, 'reject')
      setSyncState(profile.id, 'none')
      try {
        const res = await fetch(`/api/people/${profile.id}/sync/reject`, { method: 'POST' })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not reject request.')
          throw new Error(message)
        }
        showToast('Sync rejected')
      } catch (e) {
        setSyncState(profile.id, 'request_received')
        showToast(e instanceof Error ? e.message : 'Could not reject request.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [setBusy, setSyncState, showToast]
  )

  return (
    <>
      <TopBar title="People" />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : visibleProfiles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProfiles.map((profile) => {
              const userProjects = getProjectsForUser(profile.id)
              const isCurrentUser = profile.id === currentProfile?.id
              const isFollowing = !!follows[profile.id]
              const syncState = syncStates[profile.id] ?? 'none'
              const busy = pendingByUser[profile.id] ?? null
              return (
                <PersonCard
                  key={profile.id}
                  profile={profile}
                  projects={userProjects}
                  isFollowing={isFollowing}
                  isCurrentUser={isCurrentUser}
                  syncState={syncState}
                  busy={busy}
                  onOpen={() => setSelectedProfileId(profile.id)}
                  onFollow={() => handleFollow(profile)}
                  onSync={() => handleSync(profile)}
                  onAccept={() => handleAccept(profile)}
                  onReject={() => handleReject(profile)}
                />
              )
            })}
          </div>
        )}
      </div>

      <ProfileModal
        profile={selectedProfile}
        open={!!selectedProfile}
        onClose={() => setSelectedProfileId(null)}
        projects={selectedProfile ? getProjectsForUser(selectedProfile.id) : []}
        isCurrentUser={selectedProfile?.id === currentProfile?.id}
        usageStats={selectedProfile?.id === currentProfile?.id ? usageStats : null}
      />

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all ${
              t.tone === 'success'
                ? 'bg-gray-900/95 text-white border-gray-800 dark:bg-gray-100/95 dark:text-gray-900 dark:border-gray-200'
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
  isFollowing,
  isCurrentUser,
  syncState,
  busy,
  onOpen,
  onFollow,
  onSync,
  onAccept,
  onReject,
}: {
  profile: Profile
  projects: Project[]
  isFollowing: boolean
  isCurrentUser: boolean
  syncState: SyncState
  busy: 'follow' | SyncBusyAction | null
  onOpen: () => void
  onFollow: () => void
  onSync: () => void
  onAccept: () => void
  onReject: () => void
}) {
  const followLabel = isFollowing ? 'Following' : 'Follow'

  const followClassName = isFollowing
    ? 'border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30'
    : ''

  const openOnKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  const renderSyncControl = () => {
    if (isCurrentUser) {
      return (
        <Badge className="justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          Your profile
        </Badge>
      )
    }

    if (syncState === 'synced') {
      return (
        <Button
          size="sm"
          loading={busy === 'sync'}
          disabled={busy !== null}
          onClick={onSync}
          className="bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white"
        >
          Synced
        </Button>
      )
    }
    if (syncState === 'pending') {
      return (
        <Button
          size="sm"
          variant="secondary"
          loading={busy === 'sync'}
          disabled={busy !== null}
          onClick={onSync}
          className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50"
        >
          Pending
        </Button>
      )
    }
    if (syncState === 'request_received') {
      return (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            loading={busy === 'accept'}
            disabled={busy !== null}
            onClick={onAccept}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'reject'}
            disabled={busy !== null}
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      )
    }
    return (
      <Button
        size="sm"
        loading={busy === 'sync'}
        disabled={busy !== null}
        onClick={onSync}
      >
        Sync
      </Button>
    )
  }

  return (
    <Card
      padding="md"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnKeyboard}
      className={`flex cursor-pointer flex-col gap-4 transition-colors ${
        isCurrentUser
          ? 'border-purple-300/80 bg-purple-50/50 dark:border-purple-700/70 dark:bg-purple-950/20'
          : 'hover:border-purple-200 dark:hover:border-purple-800/60'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={profile.name} src={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {profile.name}
            </h3>
            {isCurrentUser && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                You
              </Badge>
            )}
          </div>
          {syncState === 'request_received' && !isCurrentUser && (
            <p className="text-xs font-medium text-purple-600 dark:text-purple-300">
              Wants to Sync with you
            </p>
          )}
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {profile.role ?? 'Member'}
          </p>
          <p className="truncate text-xs text-gray-400 dark:text-gray-600">{profile.email}</p>
        </div>
        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col items-stretch gap-1.5">
            {!isCurrentUser && (
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
            )}
            {renderSyncControl()}
          </div>
        </div>
      </div>

      {profile.tools_used && profile.tools_used.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
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
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Projects
          </p>
          <div className="flex flex-col gap-1">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
                <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.name}</span>
              </div>
            ))}
            {projects.length > 3 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                +{projects.length - 3} more projects
              </p>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-50 pt-2 dark:border-gray-800">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Activity
        </p>
        <ActivityBars seed={profile.id} />
        <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">Last 2 weeks</p>
      </div>
    </Card>
  )
}

function ProfileModal({
  profile,
  open,
  onClose,
  projects,
  isCurrentUser,
  usageStats,
}: {
  profile: Profile | null
  open: boolean
  onClose: () => void
  projects: Project[]
  isCurrentUser: boolean
  usageStats: UsageStats | null
}) {
  if (!profile) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCurrentUser ? 'Your profile' : profile.name}
      className="max-w-3xl"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={profile.name} src={profile.avatar_url} size="lg" className="h-14 w-14" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {profile.name}
                </h3>
                {isCurrentUser && (
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    You
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Role: Member</p>
              {profile.role && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Focus: {profile.role}
                </p>
              )}
            </div>
          </div>
          <div className="min-w-[180px] rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Activity
            </p>
            <div className="mt-3">
              <ActivityBars seed={profile.id} barCount={14} heightClassName="h-3" />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Last 2 weeks</p>
          </div>
        </div>

        {profile.tools_used && profile.tools_used.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Tools
            </p>
            <div className="flex flex-wrap gap-1.5">
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
          </section>
        )}

        {projects.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Projects
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {project.status[0].toUpperCase() + project.status.slice(1)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {isCurrentUser && usageStats && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Your Codex Usage
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Token usage and daily limit pressure for your Codex access.
                </p>
              </div>
              <a
                href="https://chatgpt.com/codex"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Open in Codex
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <UsageMetricCard
                label="Codex requests"
                value={usageStats.codex.requests.toLocaleString()}
                detail={`${usageStats.codex.remainingPercent}% usage left`}
              />
              <UsageMetricCard
                label="Tokens"
                value={formatCompactNumber(usageStats.codex.totalTokens)}
                detail={`${formatCompactNumber(usageStats.codex.inputTokens)} in / ${formatCompactNumber(usageStats.codex.outputTokens)} out`}
              />
              <UsageMetricCard
                label="Last active"
                value={usageStats.codex.lastActiveLabel}
                detail={usageStats.codex.resetLabel}
              />
              <UsageMetricCard
                label="Most used model"
                value={usageStats.codex.mostUsedModel}
                detail="Codex sessions"
              />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Last 7 days
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tokens per day and whether the daily usage was close to the limit.
                  </p>
                </div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-300">
                  {formatCompactNumber(
                    usageStats.dailyCodex.reduce((sum, day) => sum + day.tokens, 0)
                  )}{' '}
                  tokens
                </p>
              </div>

              <div className="grid grid-cols-7 items-end gap-2">
                {usageStats.dailyCodex.map((day) => {
                  const percent = Math.min(100, Math.round((day.tokens / day.limitTokens) * 100))

                  return (
                    <div key={day.dateLabel} className="flex min-w-0 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end rounded-lg bg-gray-50 p-1 dark:bg-gray-950/50">
                        <div
                          className={`w-full rounded-md ${usageStatusBarClass(day.status)}`}
                          style={{ height: `${Math.max(10, percent)}%` }}
                          title={`${day.dateLabel}: ${formatCompactNumber(day.tokens)} tokens`}
                        />
                      </div>
                      <div className="min-w-0 text-center">
                        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                          {day.label}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {formatCompactNumber(day.tokens)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {usageStats.dailyCodex.map((day) => (
                  <div
                    key={`${day.dateLabel}-row`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/50"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {day.dateLabel}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {day.requests} requests · {formatCompactNumber(day.tokens)} tokens
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${usageStatusPillClass(day.status)}`}>
                      {usageStatusLabel(day.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

function ActivityBars({
  seed,
  barCount = 14,
  heightClassName = 'h-2',
}: {
  seed: string
  barCount?: number
  heightClassName?: string
}) {
  const bars = useMemo(() => {
    const state = { h: 0 }
    for (let i = 0; i < seed.length; i++) {
      state.h = (state.h * 31 + seed.charCodeAt(i)) >>> 0
    }
    return Array.from({ length: barCount }, () => {
      state.h = (state.h * 1664525 + 1013904223) >>> 0
      const r = (state.h & 0xffff) / 0xffff
      state.h = (state.h * 1664525 + 1013904223) >>> 0
      const intensity = (state.h & 0xffff) / 0xffff
      return r > 0.45 ? 0.25 + intensity * 0.6 : 0
    })
  }, [seed, barCount])

  return (
    <div className="flex gap-1">
      {bars.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${heightClassName}`}
          style={{
            backgroundColor:
              v > 0 ? `rgba(168, 85, 247, ${0.25 + v * 0.6})` : 'rgba(168, 85, 247, 0.08)',
          }}
        />
      ))}
    </div>
  )
}

function UsageMetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20">
        <svg
          className="h-7 w-7 text-purple-500"
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
      <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
        Invite teammates or wait for new builders to join the workspace. They&apos;ll show up here
        once they&apos;re onboarded.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <svg
          className="h-7 w-7 text-red-500"
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
      <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{message}</p>
      <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function buildFallbackCurrentProfile(userId: string): Profile {
  return {
    id: userId,
    email: 'you@sync.app',
    name: 'You',
    first_name: null,
    last_name: null,
    username: null,
    selected_avatar: null,
    avatar_url: null,
    role: 'Member',
    tools_used: ['Codex', 'ChatGPT', 'GitHub'],
    onboarding_completed: true,
    created_at: new Date().toISOString(),
  }
}

function buildUsageStats(profile: Profile): UsageStats {
  const seed = profile.id
  const dailyCodex = Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)

    const requests = 12 + seededNumber(seed, 10 + index, 46)
    const inputTokens = 86_000 + seededNumber(seed, 30 + index, 420_000)
    const outputTokens = 24_000 + seededNumber(seed, 50 + index, 160_000)
    const tokens = inputTokens + outputTokens
    const limitTokens = 620_000
    const percent = tokens / limitTokens

    return {
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      dateLabel: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
      requests,
      tokens,
      limitTokens,
      status: percent >= 0.96 ? 'used_up' : percent >= 0.72 ? 'heavy' : 'normal',
    } satisfies UsageStats['dailyCodex'][number]
  })
  const totalTokens = dailyCodex.reduce((sum, day) => sum + day.tokens, 0)
  const requests = dailyCodex.reduce((sum, day) => sum + day.requests, 0)
  const inputTokens = Math.round(totalTokens * 0.72)
  const outputTokens = totalTokens - inputTokens
  const heaviestDay = dailyCodex.reduce((max, day) => (day.tokens > max.tokens ? day : max), dailyCodex[0])

  return {
    codex: {
      requests,
      totalTokens,
      inputTokens,
      outputTokens,
      remainingPercent: Math.max(3, 100 - Math.round((heaviestDay.tokens / heaviestDay.limitTokens) * 100)),
      resetLabel: `Daily limit resets ${formatTimeOfDayFromNow(8 + seededNumber(seed, 0, 180))}`,
      lastActiveLabel: `${1 + seededNumber(seed, 4, 11)} hours ago`,
      mostUsedModel: ['GPT-4.1', 'GPT-5.1 Codex', 'GPT-5.2'][seededNumber(seed, 5, 3)],
    },
    dailyCodex,
  }
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value)
}

function usageStatusLabel(status: UsageStats['dailyCodex'][number]['status']) {
  if (status === 'used_up') return 'Used up'
  if (status === 'heavy') return 'High usage'
  return 'Normal'
}

function usageStatusBarClass(status: UsageStats['dailyCodex'][number]['status']) {
  if (status === 'used_up') return 'bg-red-500'
  if (status === 'heavy') return 'bg-amber-400'
  return 'bg-gradient-to-t from-purple-600 to-fuchsia-400'
}

function usageStatusPillClass(status: UsageStats['dailyCodex'][number]['status']) {
  if (status === 'used_up') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
  if (status === 'heavy') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
}

function seededNumber(seed: string, index: number, max: number) {
  let hash = 2166136261
  const input = `${seed}:${index}`
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % max
}

function formatTimeOfDayFromNow(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000)
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
