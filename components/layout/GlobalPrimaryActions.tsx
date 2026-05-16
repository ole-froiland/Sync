'use client'

import { useEffect, useState } from 'react'
import { Bot, GitBranch, Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import CreatePostModal from '@/components/dashboard/CreatePostModal'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import { useUser } from '@/context/UserContext'
import type { Post, Project } from '@/types'

export default function GlobalPrimaryActions() {
  const profile = useUser()
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [repoModalOpen, setRepoModalOpen] = useState(false)

  useEffect(() => {
    const openPostModal = () => setPostModalOpen(true)
    const openRepoModal = () => setRepoModalOpen(true)

    window.addEventListener('sync:open-post-modal', openPostModal)
    window.addEventListener('sync:open-repo-modal', openRepoModal)

    return () => {
      window.removeEventListener('sync:open-post-modal', openPostModal)
      window.removeEventListener('sync:open-repo-modal', openRepoModal)
    }
  }, [])

  function handlePostCreated(post: Post) {
    window.dispatchEvent(new CustomEvent<Post>('sync:post-created', { detail: post }))
    setPostModalOpen(false)
  }

  function handleRepoCreated(project: Project | null) {
    window.dispatchEvent(
      new CustomEvent<Project | null>('sync:github-repo-created', { detail: project })
    )
    setRepoModalOpen(false)
  }

  return (
    <>
      <div className="fixed right-4 top-16 z-[70] sm:right-6">
        <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/80 bg-white/90 p-2 shadow-lg shadow-gray-900/10 backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/90 dark:shadow-black/20 sm:flex-row sm:items-center">
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Sparkles size={14} />
            Claude
          </a>
          <a
            href="https://chatgpt.com/codex"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Bot size={14} />
            Codex
          </a>
          <Button size="sm" variant="secondary" onClick={() => setRepoModalOpen(true)}>
            <GitBranch size={14} />
            New repo
          </Button>
          <Button size="sm" onClick={() => setPostModalOpen(true)}>
            New post
          </Button>
        </div>
      </div>

      <CreatePostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onCreated={handlePostCreated}
        userId={profile?.id ?? ''}
        userProfile={{ name: profile?.name ?? 'User', avatar_url: profile?.avatar_url ?? null }}
      />
      <CreateGitHubRepoModal
        open={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        onCreated={handleRepoCreated}
      />
    </>
  )
}
