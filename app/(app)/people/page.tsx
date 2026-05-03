'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
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

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        setProfiles(mockProfiles)
        setProjects(mockProjects)
        setLoading(false)
      })
      return
    }

    Promise.all([
      fetch('/api/people').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ])
      .then(([people, projs]) => {
        setProfiles(Array.isArray(people) ? people : mockProfiles)
        setProjects(Array.isArray(projs) ? projs : mockProjects)
      })
      .catch(() => {
        setProfiles(mockProfiles)
        setProjects(mockProjects)
      })
      .finally(() => setLoading(false))
  }, [])

  function getProjectsForUser(userId: string) {
    return projects.filter((p) =>
      p.members?.some((m) => (m as unknown as { id?: string; user_id?: string }).id === userId || (m as unknown as { id?: string; user_id?: string }).user_id === userId)
    )
  }

  return (
    <>
      <TopBar title="People" />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <PersonCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const userProjects = getProjectsForUser(profile.id)
              return (
                <Card key={profile.id} hover padding="md" className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <Avatar name={profile.name} src={profile.avatar_url} size="lg" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {profile.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {profile.role ?? 'Member'}
                      </p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 truncate">
                        {profile.email}
                      </p>
                    </div>
                  </div>

                  {/* Tools */}
                  {profile.tools_used && profile.tools_used.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                        Tools
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {profile.tools_used.map((tool) => (
                          <Badge
                            key={tool}
                            className={TOOL_COLORS[tool] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                          >
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {userProjects.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                        Projects
                      </p>
                      <div className="flex flex-col gap-1">
                        {userProjects.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                              {p.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity (visual placeholder - last 14 days) */}
                  <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
                      Activity
                    </p>
                    <div className="flex gap-1">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-2 rounded-sm"
                          style={{
                            backgroundColor:
                              Math.random() > 0.5
                                ? `rgba(99, 102, 241, ${0.2 + Math.random() * 0.6})`
                                : 'rgb(243,244,246)',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Last 2 weeks</p>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
