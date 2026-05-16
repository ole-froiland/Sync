'use client'

import { useEffect, useState } from 'react'
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
