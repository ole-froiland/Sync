'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import PostDetailModal from '@/components/dashboard/PostDetailModal'
import CreatePostModal from '@/components/dashboard/CreatePostModal'
import InviteMemberModal from '@/components/dashboard/InviteMemberModal'
import CreateProjectModal from '@/components/projects/CreateProjectModal'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import FeedView from '@/components/dashboard/views/FeedView'
import DiscoverView from '@/components/dashboard/views/DiscoverView'
import TrendingView from '@/components/dashboard/views/TrendingView'
import Button from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'
import { mockPosts } from '@/lib/mock-data'
import type { Post, NewsItem, ModelCost } from '@/types'
import { GitBranch } from 'lucide-react'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')
const NEWS_REFRESH_MS = 5 * 60 * 1000

type Tab = 'feed' | 'discover' | 'trending'

const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'discover', label: 'Discover' },
  { id: 'trending', label: 'Trending' },
]

export default function DashboardPage() {
  const profile = useUser()

  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [tabReady, setTabReady] = useState(false)

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  const [modelCosts, setModelCosts] = useState<ModelCost[]>([])

  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [githubModalOpen, setGithubModalOpen] = useState(false)

  // Hydrate tab from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem('dashboard-tab') as Tab | null
      if (saved && ['feed', 'discover', 'trending'].includes(saved)) {
        setActiveTab(saved)
      }
      setTabReady(true)
    })
  }, [])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    localStorage.setItem('dashboard-tab', tab)
  }

  // Fetch posts
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        setPosts(mockPosts)
        setPostsLoading(false)
      })
      return
    }
    fetch('/api/posts')
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : mockPosts))
      .catch(() => setPosts(mockPosts))
      .finally(() => setPostsLoading(false))
  }, [])

  const fetchNews = useCallback(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((data) => {
        setNews(Array.isArray(data) ? data.slice(0, 10) : [])
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, NEWS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchNews])

  useEffect(() => {
    fetch('/api/model-costs')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setModelCosts(data)
      })
      .catch(() => {})
  }, [])

  // Supabase Realtime: new posts appear without page refresh
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return
    let cleanup: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const channel = supabase
        .channel('public:posts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts' },
          () => {
            fetch('/api/posts')
              .then((r) => r.json())
              .then((data) => {
                if (Array.isArray(data)) setPosts(data)
              })
              .catch(() => {})
          }
        )
        .subscribe()

      cleanup = () => {
        supabase.removeChannel(channel)
      }
    }

    subscribe()
    return () => {
      cleanup?.()
    }
  }, [])

  return (
    <>
      <TopBar
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setGithubModalOpen(true)}>
              <GitBranch size={14} />
              New repo
            </Button>
            <Button size="sm" onClick={() => setPostModalOpen(true)}>
              New post
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Tab navigation */}
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 sticky top-0 bg-gray-50 dark:bg-gray-950 z-10">
          <nav className="flex items-center max-w-5xl mx-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-4 py-3.5 text-sm font-medium transition-colors ${
                  tabReady && activeTab === tab.id
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
              >
                {tab.label}
                {tabReady && activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-gray-100 rounded-t" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* View content with fade transition */}
        <div key={activeTab} className="view-transition">
          {activeTab === 'feed' && (
            <FeedView
              posts={posts}
              postsLoading={postsLoading}
              news={news}
              newsLoading={newsLoading}
              modelCosts={modelCosts}
              onPostClick={setSelectedPost}
              onFetchNews={fetchNews}
              onCreateProject={() => setProjectModalOpen(true)}
              onCreatePost={() => setPostModalOpen(true)}
              onInviteMember={() => setInviteModalOpen(true)}
            />
          )}
          {activeTab === 'discover' && <DiscoverView news={news} newsLoading={newsLoading} />}
          {activeTab === 'trending' && <TrendingView />}
        </div>
      </div>

      <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />

      <CreatePostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onCreated={(post) => setPosts((prev) => [post, ...prev])}
        userId={profile?.id ?? ''}
        userProfile={{ name: profile?.name ?? 'User', avatar_url: profile?.avatar_url ?? null }}
      />
      <CreateProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreated={() => setProjectModalOpen(false)}
        userId={profile?.id ?? ''}
      />
      <InviteMemberModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        userId={profile?.id ?? ''}
      />
      <CreateGitHubRepoModal
        open={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        onCreated={() => {}}
      />
    </>
  )
}
