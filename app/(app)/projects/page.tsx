'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import ProjectCard from '@/components/projects/ProjectCard'
import CreateProjectModal from '@/components/projects/CreateProjectModal'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import Button from '@/components/ui/Button'
import { ProjectCardSkeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
import { mockProjects } from '@/lib/mock-data'
import type { Project } from '@/types'
import { FolderKanban, GitBranch } from 'lucide-react'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

function normalizeProject(raw: Project & { members?: Array<{ profile: unknown }> }): Project {
  const members = (raw.members ?? []).map((m: { profile: unknown }) => m.profile).filter(Boolean)
  return { ...raw, members: members as Project['members'], member_count: members.length }
}

export default function ProjectsPage() {
  const profile = useUser()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | Project['status']>('all')

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        setProjects(mockProjects)
        setLoading(false)
      })
      return
    }
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data.map(normalizeProject) : mockProjects))
      .catch(() => setProjects(mockProjects))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  function handleProjectCreated(p: Project) {
    setProjects((prev) => [p, ...prev])
    setCreateOpen(false)
  }

  function handleGitHubProjectCreated(p: Project | null) {
    if (p) setProjects((prev) => [p, ...prev])
    setGithubOpen(false)
  }

  return (
    <>
      <TopBar
        title="Projects"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setGithubOpen(true)}>
              <GitBranch size={14} />
              GitHub repo
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          {(['all', 'idea', 'building', 'live'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {!loading && (
            <span className="text-sm text-gray-400 ml-2">{filtered.length} projects</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <FolderKanban size={40} className="text-gray-200 dark:text-gray-700" />
            <p className="text-gray-400 dark:text-gray-500 text-sm">No projects yet.</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleProjectCreated}
        userId={profile?.id ?? ''}
      />
      <CreateGitHubRepoModal
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        onCreated={handleGitHubProjectCreated}
      />
    </>
  )
}
